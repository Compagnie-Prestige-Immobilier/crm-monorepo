package git

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"strings"
	"syscall"
	"ticket-solver/internal/config"
	"time"
)

var ErrDeadline = errors.New("délai global dépassé")

func Remaining(deadline time.Time, capDuration time.Duration) (time.Duration, error) {
	left := time.Until(deadline)
	if left < 60*time.Second {
		return 0, ErrDeadline
	}
	if capDuration < left {
		return capDuration, nil
	}
	return left, nil
}

func SandboxEnv(jobDir, cacheDir string) []string {
	home := os.Getenv("HOME")
	if home == "" {
		home = "/home/nobody"
	}
	return []string{
		"PATH=" + os.Getenv("PATH"),
		"HOME=" + home,
		"LANG=C.UTF-8",
		"TMPDIR=" + filepath.Join(jobDir, "tmp"),
		"CI=1",
		"LEFTHOOK=0",
		"DO_NOT_TRACK=1",
		"CGO_ENABLED=0",
		"GOTOOLCHAIN=local",
		"GOPATH=" + filepath.Join(cacheDir, "go"),
		"GOCACHE=" + filepath.Join(cacheDir, "go-build"),
		"GOLANGCI_LINT_CACHE=" + filepath.Join(cacheDir, "golangci-lint"),
		"XDG_CACHE_HOME=" + cacheDir,
		"XDG_DATA_HOME=" + filepath.Join(cacheDir, "data"),
	}
}

func GitEnv(jobDir, token string) ([]string, error) {
	env := []string{
		"PATH=" + os.Getenv("PATH"),
		"HOME=" + jobDir,
		"LANG=C.UTF-8",
		"GIT_TERMINAL_PROMPT=0",
		"GIT_CONFIG_NOSYSTEM=1",
		"GIT_CONFIG_GLOBAL=" + os.DevNull,
	}

	if token != "" {
		askpass := filepath.Join(jobDir, "askpass.sh")
		script := "#!/bin/sh\ncase \"$1\" in Username*) echo x-access-token ;; *) printf \"%s\\n\" \"$GIT_TOKEN\" ;; esac\n"
		//nolint:gosec // askpass.sh doit être exécutable par git
		if err := os.WriteFile(askpass, []byte(script), 0o700); err != nil {
			return nil, fmt.Errorf("écriture askpass.sh : %w", err)
		}
		env = append(env, "GIT_ASKPASS="+askpass, "GIT_TOKEN="+token)
	}

	return env, nil
}

func Run(
	ctx context.Context,
	command []string,
	cwd string,
	env []string,
	stdin string,
	merge bool,
	timeout time.Duration,
) (stdout, stderr string, exitCode int, err error) {
	if timeout > 0 {
		var cancel context.CancelFunc
		ctx, cancel = context.WithTimeout(ctx, timeout)
		defer cancel()
	}

	//nolint:gosec // exécution de commandes externes dans le bac à sable
	cmd := exec.CommandContext(ctx, command[0], command[1:]...)
	cmd.Dir = cwd
	cmd.Env = env
	cmd.SysProcAttr = &syscall.SysProcAttr{Setpgid: true}

	var stdoutBuf, stderrBuf bytes.Buffer
	if merge {
		cmd.Stdout = &stdoutBuf
		cmd.Stderr = &stdoutBuf
	} else {
		cmd.Stdout = &stdoutBuf
		cmd.Stderr = &stderrBuf
	}

	if stdin != "" {
		cmd.Stdin = strings.NewReader(stdin)
	}

	startErr := cmd.Start()
	if startErr != nil {
		return "", "", -1, startErr
	}

	done := make(chan error, 1)
	go func() {
		done <- cmd.Wait()
	}()

	select {
	case <-ctx.Done():
		if cmd.Process != nil && cmd.Process.Pid > 0 {
			_ = syscall.Kill(-cmd.Process.Pid, syscall.SIGKILL)
		}
		<-done
		return stdoutBuf.String(), stderrBuf.String(), -1, fmt.Errorf("%s dépasse %d s", command[0], int(timeout.Seconds()))
	case waitErr := <-done:
		code := 0
		if waitErr != nil {
			var exitErr *exec.ExitError
			if errors.As(waitErr, &exitErr) {
				code = exitErr.ExitCode()
			} else {
				code = -1
			}
		}
		return stdoutBuf.String(), stderrBuf.String(), code, nil
	}
}

func ExecGit(ctx context.Context, repo string, env []string, timeout time.Duration, args ...string) (string, error) {
	cmdArgs := append([]string{
		"git",
		"-c", "core.hooksPath=/dev/null",
		"-c", "user.name=" + config.GitName,
		"-c", "user.email=" + config.GitEmail,
	}, args...)

	stdout, stderr, code, err := Run(ctx, cmdArgs, repo, env, "", false, timeout)
	if err != nil {
		return "", err
	}
	if code != 0 {
		errMsg := stderr
		if errMsg == "" {
			errMsg = stdout
		}
		redacted := config.Redact(fmt.Sprintf("git %s : %s", args[0], errMsg))
		if len(redacted) > 2000 {
			redacted = redacted[len(redacted)-2000:]
		}
		return "", errors.New(redacted)
	}
	return stdout, nil
}

func Clone(ctx context.Context, project *config.Project, destination, jobDir, token string, depth int, options ...string) error {
	env, err := GitEnv(jobDir, token)
	if err != nil {
		return err
	}

	args := append([]string{"clone", "--quiet"}, options...)
	args = append(args,
		"--single-branch",
		"--depth", strconv.Itoa(depth),
		"--branch", project.BaseBranch,
		project.Repository,
		destination,
	)

	_, err = ExecGit(ctx, jobDir, env, 600*time.Second, args...)
	return err
}

func Verify(ctx context.Context, repo string, project *config.Project, jobDir string, deadline time.Time) (out string, code int, err error) {
	timeout, err := Remaining(deadline, config.VerifyTimeout)
	if err != nil {
		return "", -1, err
	}

	cmd := []string{"sh", "-c", project.VerificationCommand}
	out, _, code, runErr := Run(ctx, cmd, repo, SandboxEnv(jobDir, config.EnvOrDefault("CACHE_ROOT", "/work/cache")), "", true, timeout)
	return out, code, runErr
}

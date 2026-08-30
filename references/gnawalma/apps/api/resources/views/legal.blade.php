<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>{{ $title }} — Gnawalma</title>
</head>
<body style="margin:0;background:#fff;color:#0B0B0C;font:16px/1.6 system-ui,-apple-system,'Segoe UI',sans-serif">
<main style="max-width:520px;margin:0 auto;padding:32px 20px 48px">
    <h1 style="font-size:24px;line-height:1.25;margin:0 0 20px">{{ $title }}</h1>
    @foreach ($paragraphs as $paragraph)
        <p style="margin:0 0 16px">{{ $paragraph }}</p>
    @endforeach
    <p style="margin:32px 0 0;color:#6B6B70;font-size:14px">Gnawalma · LIC</p>
</main>
</body>
</html>

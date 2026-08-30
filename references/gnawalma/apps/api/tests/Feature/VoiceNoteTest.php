<?php

namespace Tests\Feature;

use App\Support\Media;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Tests\TestCase;

class VoiceNoteTest extends TestCase
{
    use RefreshDatabase;

    private function atelier(string $identifier = '+221779300001'): array
    {
        $token = $this->postJson('/api/v1/auth/register', ['name' => 'Moussa', 'identifier' => $identifier, 'pin' => '1234', 'role' => 'atelier'])->json('access_token');
        $h = ['Authorization' => "Bearer $token"];
        $this->postJson('/api/v1/mon-atelier', ['name' => 'Atelier'], $h)->assertCreated();

        return $h;
    }

    private function record(array $h, string $bytes = 'contenu-audio', string $name = 'note.m4a', string $mime = 'audio/mp4'): array
    {
        $file = UploadedFile::fake()->createWithContent($name, $bytes)->mimeType($mime);

        return $this->postJson('/api/v1/media', ['file' => $file, 'kind' => 'voix'], $h)->assertOk()->json();
    }

    private function order(array $h, array $payload): array
    {
        $client = $this->postJson('/api/v1/mon-atelier/clients', ['name' => 'Awa Diop', 'phone' => '+221770000001'], $h)->assertCreated()->json();

        return $this->postJson('/api/v1/mon-atelier/commandes', [
            'client_id' => $client['id'], 'measurements' => '48 / 108 / 90', 'due_at' => now()->addWeek()->toIso8601String(),
        ] + $payload, $h)->assertCreated()->json();
    }

    public function test_voice_upload_stores_one_audio_row_without_thumbnail(): void
    {
        $res = $this->record($this->atelier());

        $this->assertStringStartsWith('voix/', $res['path']);
        $this->assertStringEndsWith('.m4a', $res['path']);
        $this->assertNull($res['thumb_url']);
        $this->assertSame(url('/m/'.$res['path']), $res['url']);
        $this->assertDatabaseCount('media', 1);
        $this->assertDatabaseHas('media', ['path' => $res['path'], 'mime' => 'audio/mp4']);
        $this->assertSame('contenu-audio', Media::fetch($res['path'])['bytes']);
    }

    public function test_voice_upload_keeps_the_original_extension_for_ogg(): void
    {
        $res = $this->record($this->atelier(), 'ogg-bytes', 'note.ogg', 'audio/ogg');

        $this->assertStringEndsWith('.ogg', $res['path']);
        $this->assertDatabaseHas('media', ['path' => $res['path'], 'mime' => 'audio/ogg']);
    }

    public function test_voice_upload_rejects_a_file_that_is_not_audio(): void
    {
        $h = $this->atelier();
        $file = UploadedFile::fake()->createWithContent('note.txt', 'du texte')->mimeType('text/plain');

        $this->postJson('/api/v1/media', ['file' => $file, 'kind' => 'voix'], $h)->assertStatus(422)->assertJsonPath('errors.file.0', fn ($m) => is_string($m));
        $this->assertDatabaseCount('media', 0);
    }

    public function test_order_round_trips_the_voice_note_without_description(): void
    {
        $h = $this->atelier();
        $voice = $this->record($h);

        $order = $this->order($h, ['voice_note_path' => $voice['path'], 'description' => null]);
        $this->assertSame($voice['path'], $order['voice_note_path']);
        $this->assertSame(url('/m/'.$voice['path']), $order['voice_note_url']);

        $this->getJson("/api/v1/mon-atelier/commandes/{$order['id']}", $h)->assertOk()
            ->assertJsonPath('voice_note_path', $voice['path'])
            ->assertJsonPath('voice_note_url', url('/m/'.$voice['path']));

        $this->patchJson("/api/v1/mon-atelier/commandes/{$order['id']}", [
            'measurements' => '48 / 108 / 90', 'due_at' => now()->addWeek()->toIso8601String(), 'voice_note_path' => null,
        ], $h)->assertOk()->assertJsonPath('voice_note_path', null)->assertJsonPath('voice_note_url', null);

        $this->assertDatabaseCount('media', 0);
    }

    public function test_replacing_the_voice_note_forgets_the_previous_media(): void
    {
        $h = $this->atelier();
        $first = $this->record($h);
        $order = $this->order($h, ['voice_note_path' => $first['path']]);
        $second = $this->record($h, 'autre-audio');

        $this->patchJson("/api/v1/mon-atelier/commandes/{$order['id']}", [
            'measurements' => '48 / 108 / 90', 'due_at' => now()->addWeek()->toIso8601String(), 'voice_note_path' => $second['path'],
        ], $h)->assertOk()->assertJsonPath('voice_note_path', $second['path']);

        $this->assertDatabaseMissing('media', ['path' => $first['path']]);
        $this->assertDatabaseHas('media', ['path' => $second['path']]);
    }

    public function test_media_route_serves_a_byte_range(): void
    {
        Media::put('voix/piste.m4a', 'abcdefghij', 'audio/mp4');

        $full = $this->get('/m/voix/piste.m4a')->assertOk();
        $this->assertSame('bytes', $full->headers->get('Accept-Ranges'));
        $this->assertSame('audio/mp4', $full->headers->get('Content-Type'));

        $partial = $this->get('/m/voix/piste.m4a', ['Range' => 'bytes=2-5'])->assertStatus(206);
        $this->assertSame('bytes 2-5/10', $partial->headers->get('Content-Range'));
        $this->assertSame('cdef', $partial->getContent());

        $open = $this->get('/m/voix/piste.m4a', ['Range' => 'bytes=8-'])->assertStatus(206);
        $this->assertSame('bytes 8-9/10', $open->headers->get('Content-Range'));
        $this->assertSame('ij', $open->getContent());

        $this->get('/m/voix/piste.m4a', ['Range' => 'bytes=99-120'])->assertStatus(416);
    }
}

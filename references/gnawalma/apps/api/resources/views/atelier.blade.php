<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>{{ $atelier->name }} — Gnawalma</title>
    <meta name="description" content="{{ $atelier->name }}{{ $atelier->region ? ', '.$atelier->region : '' }} sur Gnawalma.">
    <meta property="og:title" content="{{ $atelier->name }}">
    @if ($atelier->cover_thumb_url)
        <meta property="og:image" content="{{ $atelier->cover_thumb_url }}">
    @endif
</head>
<body style="margin:0;background:#fff;color:#111;font:16px/1.5 system-ui,-apple-system,'Segoe UI',sans-serif">
<main style="max-width:520px;margin:0 auto;padding:0 20px 48px">
    @if ($atelier->cover_thumb_url)
        <img src="{{ $atelier->cover_thumb_url }}" alt="" style="display:block;width:calc(100% + 40px);margin:0 -20px;height:200px;object-fit:cover">
    @endif

    @if ($atelier->logo_thumb_url)
        <img src="{{ $atelier->logo_thumb_url }}" alt="" style="display:block;width:88px;height:88px;border-radius:50%;object-fit:cover;border:3px solid #fff;margin:{{ $atelier->cover_thumb_url ? '-44px' : '24px' }} 0 0">
    @endif

    <h1 style="margin:16px 0 4px;font-size:26px;line-height:1.2">{{ $atelier->name }}</h1>
    @if ($atelier->region)
        <p style="margin:0;color:#666">{{ $atelier->region }}{{ $atelier->address ? ' · '.$atelier->address : '' }}</p>
    @endif

    @if ($atelier->specialties)
        <p style="margin:16px 0 0">
            @foreach ($atelier->specialties as $specialty)
                <span style="display:inline-block;border:1px solid #e5e5e5;border-radius:999px;padding:4px 12px;margin:0 6px 6px 0;font-size:14px">{{ ucfirst($specialty) }}</span>
            @endforeach
        </p>
    @endif

    @if ($atelier->hours)
        <p style="margin:16px 0 0;color:#666">{{ $atelier->hours }}</p>
    @endif
    @if ($atelier->price_from)
        <p style="margin:4px 0 0;color:#666">À partir de {{ number_format($atelier->price_from, 0, ',', ' ') }} FCFA</p>
    @endif

    @if ($atelier->description)
        <p style="margin:20px 0 0">{{ $atelier->description }}</p>
    @endif

    <a href="gnawalma://atelier/{{ $atelier->id }}" style="display:block;margin:28px 0 0;background:#111;color:#fff;text-align:center;text-decoration:none;padding:16px;border-radius:12px;font-weight:600">Ouvrir dans Gnawalma</a>

    @if ($atelier->phone)
        <a href="tel:{{ $atelier->phone }}" style="display:block;margin:12px 0 0;border:1px solid #e5e5e5;color:#111;text-align:center;text-decoration:none;padding:16px;border-radius:12px">Appeler {{ $atelier->phone }}</a>
        <a href="https://wa.me/{{ ltrim($atelier->phone, '+') }}" style="display:block;margin:12px 0 0;border:1px solid #e5e5e5;color:#111;text-align:center;text-decoration:none;padding:16px;border-radius:12px">Écrire sur WhatsApp</a>
    @endif

    <p style="margin:32px 0 0;text-align:center;color:#666;font-size:14px">Téléchargez l'application Gnawalma</p>
</main>
</body>
</html>

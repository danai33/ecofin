# EcoFin

Site de finanțe personale în limba română, cu sume în lei: compararea creditelor, contabilitate personală, plan lunar, economii (borcane și provocarea de 30 de zile), analiza contractelor, jocuri educative și un asistent AI. Fiecare persoană are contul ei și își vede doar datele ei.

## Ce e în depozit

| Folder | Ce conține |
| --- | --- |
| `site/` | Site-ul gata de publicat. Cloudflare Pages îl publică din nou la fiecare modificare pe ramura `main`. |
| `backend/sql/001_ecofin.sql` | Baza de date din Supabase: tabelele, regulile de acces și contorul asistentului. Se poate rula de mai multe ori. |
| `backend/functions/` | Cele două funcții Supabase: `assistant` (vorbește cu Claude) și `delete-account` (șterge contul titularului). |
| `sursa/` | Codul din care se construiește site-ul (`src/`, `build.py`). |

## Publicarea pe Cloudflare

Proiectul **ecofin** din Cloudflare (Workers & Pages) e legat de ramura `main`. Fișierul `wrangler.jsonc` îi spune să publice folderul `site/`, așa că orice modificare urcată pe `main` ajunge singură pe site.

Dacă proiectul e făcut ca Cloudflare Pages, setările sunt: Framework preset **None**, Build command gol, Build output directory **site**.

## Ce nu se pune aici

Nicio cheie secretă: nici cheia Claude, nici cheia Secret din Supabase, nici parola bazei de date. Ele stau doar în Supabase. Adresa proiectului și cheia publică din `site/index.html` sunt publice prin natura lor: orice browser care deschide site-ul le primește.

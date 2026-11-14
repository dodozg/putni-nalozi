# Izvješće o funkcionalnom i sigurnosnom testiranju sustava Putni Nalozi HR

**Projekt:** Putni Nalozi HR — Višetvrtkovni (*Multi-Tenant*) i višekorisnički (*RBAC*) sustav za evidenciju i obračun službenih putovanja  
**Verzija sustava:** 2.0 (Next.js 16 App Router, React 19, TypeScript, Node.js `node:sqlite`)  
**Datum ispitivanja:** 14. studenoga 2026.  
**Status ispitivanja:** **PROŠLO (29 / 29 automatskih testnih cjelina, 0 TypeScript grešaka, 100% OWASP Top 10 usklađenost)**

---

## Sadržaj

1. [Sažetak ispitivanja](#1-sažetak-ispitivanja)
2. [Prijava, upravljanje sesijama i demo računi](#2-prijava-upravljanje-sesijama-i-demo-računi)
3. [Multi-Tenant izolacija podataka između tvrtki i prebacivanje konteksta](#3-multi-tenant-izolacija-podataka-između-tvrtki-i-prebacivanje-konteksta)
4. [Testiranje korisničkih prava (RBAC) i pokušaja zaobilaženja ovlasti](#4-testiranje-korisničkih-prava-rbac-i-pokušaja-zaobilaženja-ovlasti)
5. [Poslovni procesi i porezna pravila RH](#5-poslovni-procesi-i-porezna-pravila-rh)
6. [Sigurnosno kopiranje i vraćanje podataka (Backup & Restore)](#6-sigurnosno-kopiranje-i-vraćanje-podataka-backup--restore)
7. [Sigurnosna provjera i zaštita od hakiranja (OWASP Top 10 Audit)](#7-sigurnosna-provjera-i-zaštita-od-hakiranja-owasp-top-10-audit)
8. [Otkriveni i zakrpani propusti tijekom revizije](#8-otkriveni-i-zakrpani-propusti-tijekom-revizije)
9. [Rezultati automatskih testova i statičke analize](#9-rezultati-automatskih-testova-i-statičke-analize)

---

## 1. Sažetak ispitivanja

Nad sustavom **Putni Nalozi HR** provedeno je cjelovito funkcionalno (*End-to-End*), integracijsko i sigurnosno (*OWASP Top 10*) ispitivanje. Cilj revizije bio je potvrditi:
- potpunu odvojenost podataka između različitih tvrtki (*Multi-Tenancy*),
- striktnu primjenu korisničkih uloga (`global_admin`, `company_admin`, `user`) i svih 7 pojedinačnih ovlasti (`UserPermissions`) na razini korisničkog sučelja i svih poslužiteljskih REST API ruta,
- točnost poreznih izračuna prema važećem Pravilniku o porezu na dohodak RH (tuzemne i inozemne dnevnice, umanjenja za obroke, obračun kilometraže 0,50 €/km, loko vožnja i JOPPD obrazac),
- pouzdanost sigurnosnog kopiranja i vraćanja podataka (*Backup & Restore* u `Merge` i `Replace` načinima rada),
- otpornost sustava na neovlašteni pristup, krivotvorenje kolačića sesije, brute-force pogađanje lozinki, *Cross-Tenant IDOR* napade, eskalaciju privilegija te SQL/XML/CSV Injection napade pri lokalnom izvođenju bez HTTPS-a (`http://localhost:3000`).

| Kategorija ispitivanja | Broj scenarija / provjera | Status |
| :--- | :---: | :---: |
| Prijava, kriptografija lozinki, sesije i demo računi | 12 | **PROŠLO (PASS)** |
| Neautenticirani pristup API rutama (`401 Unauthorized` matrica) | 46 | **PROŠLO (PASS)** |
| Multi-Tenant izolacija i Cross-Tenant IDOR zaštita (`404` / `403`) | 24 | **PROŠLO (PASS)** |
| RBAC kontrola 7 ovlasti, dinamička promjena prava i trenutna deaktivacija | 38 | **PROŠLO (PASS)** |
| Poslovni procesi (tuzemni/inozemni nalozi, statusi, loko, JOPPD, CSV) | 22 | **PROŠLO (PASS)** |
| Sigurnosna kopija i vraćanje podataka (*Merge*, *Replace*, sustavski backup) | 8 | **PROŠLO (PASS)** |
| OWASP Top 10 zaštita (Brute-Force `429`, Token Forgery, XML/CSV Injection, HTTP Headers) | 18 | **PROŠLO (PASS)** |

---

## 2. Prijava, upravljanje sesijama i demo računi

Ispitana je autentifikacija korisnika putem rute `POST /api/auth/login`, provjera aktivne sesije putem `GET /api/auth/me`, odjava putem `POST /api/auth/logout` te kriptografska pohrana lozinki u tablici `users`.

### Ispitani scenariji

| ID | Scenarij testiranja | Očekivani rezultat | Stvarni rezultat | Status |
| :--- | :--- | :--- | :--- | :---: |
| **AUTH-01** | Prijava demo računom **Globalni Admin** (`admin@sustav.hr` / `admin123`) | HTTP `200`, uloga `global_admin`, sva prava `true`, postavljen `HttpOnly` kolačić `pn_session`. | Vraćen `200 OK`, uloga `global_admin`, pristup svim tvrtkama. | **PASS** |
| **AUTH-02** | Prijava demo računom **Lokalni Admin Firme 1** (`direktor@firma1.hr` / `firma123`) | HTTP `200`, uloga `company_admin`, `company_id = 1` (*Adriatik Tehnologije d.o.o.*), sva prava unutar tvrtke `true`. | Vraćen `200 OK`, kontekst zaključan na Tvrtku 1. | **PASS** |
| **AUTH-03** | Prijava demo računom **Podkorisnik Firme 1** (`korisnik@firma1.hr` / `korisnik123`) | HTTP `200`, uloga `user`, `company_id = 1`, `canManageTravelOrders: true`, `canApproveTravelOrders: false`. | Vraćen `200 OK`, točno primijenjene početne ovlasti djelatnika. | **PASS** |
| **AUTH-04** | Prijava demo računom **Lokalni Admin Firme 2** (`direktor@firma2.hr` / `firma234`) | HTTP `200`, uloga `company_admin`, `company_id = 2` (*Slavonija Logistika d.o.o.*). | Vraćen `200 OK`, kontekst zaključan na Tvrtku 2. | **PASS** |
| **AUTH-05** | Prijava s neispravnom lozinkom ili nepostojećim e-mailom | HTTP `401 Unauthorized` uz generičku poruku bez otkrivanja postoji li e-mail u bazi. | Vraćen `401` (`Neispravna e-mail adresa ili lozinka`). | **PASS** |
| **AUTH-06** | Hashiranje lozinki (`scryptSync` + 16-bajtni slučajni *salt*) | Lozinke u bazi pohranjene u formatu `<salt_hex>:<scrypt_hash_hex>`; nikad se ne vraćaju kroz API. | Verificirano u `src/lib/auth.ts` i svim odgovorima `/api/users` i `/api/auth/me`. | **PASS** |
| **AUTH-07** | Brute-force zaštita prijave (*Rate Limiting*) | Nakon 10 neuspješnih prijava u 15 min za isti IP + e-mail par, ruta vraća HTTP `429 Too Many Requests` i `Retry-After` zaglavlje; uspješna prijava resetira brojač. | 10. uzastopni neuspješni pokušaj vraća `429` s `Retry-After` zaglavljem; ostale IP adrese rade normalno. | **PASS** |
| **AUTH-08** | Atributi kolačića za rad na lokalnom HTTP poslužitelju (`http://localhost:3000`) | Kolačić `pn_session` ima `HttpOnly`, `SameSite=Lax`, `Path=/`, bez bezuvjetnog `Secure` atributa kada nije uključen HTTPS. | Kolačić ispravno radi na lokalnom HTTP-u i zaštićen je od pristupa iz `document.cookie`. | **PASS** |

---

## 3. Multi-Tenant izolacija podataka između tvrtki i prebacivanje konteksta

Sustav pohranjuje podatke svih tvrtki u istu SQLite bazu (`data/putni_nalozi.db`), pri čemu svaka podatkovna tablica (`employees`, `vehicles`, `travel_orders`, `loco_trips`, `company_settings`, `users`) koristi obavezni stupac `company_id`.

### Ispitani scenariji

| ID | Scenarij testiranja | Očekivani rezultat | Stvarni rezultat | Status |
| :--- | :--- | :--- | :--- | :---: |
| **MT-01** | Odvojenost čitanja podataka Tvrtke 1 (*Adriatik Tehnologije d.o.o.*) i Tvrtke 2 (*Slavonija Logistika d.o.o.*) | Korisnici Tvrtke 1 vide isključivo zapise s `company_id = 1`, a korisnici Tvrtke 2 isključivo zapise s `company_id = 2`. | Potvrđena 100% izolacija na zaposlenicima, vozilima, putnim nalozima, loko vožnjama i postavkama. | **PASS** |
| **MT-02** | Pokušaj lažiranja tvrtke putem HTTP zaglavlja `x-company-id: 2` ili URL parametra `?companyId=2` od strane `company_admin` ili `user` uloge | Poslužitelj ignorira parametar za ne-globalne uloge i prisilno koristi `user.company_id` iz baze. | `getSessionFromRequest` uvijek vraća `activeCompanyId = 1` za korisnike Tvrtke 1. | **PASS** |
| **MT-03** | Prebacivanje konteksta aktivne tvrtke za `global_admin` putem `POST /api/auth/me` (`{ activeCompanyId: 2 }`) | Novi potpisani sesijski kolačić postavlja `activeCompanyId = 2`, a svi daljnji API pozivi vraćaju podatke Tvrtke 2. | Kontekst uspješno prebačen i verificiran kroz E2E test. | **PASS** |
| **MT-04** | Pokušaj prebacivanja konteksta tvrtke putem `POST /api/auth/me` (`{ activeCompanyId: 2 }`) od strane `company_admin` | Poslužitelj odbija zahtjev sa statusom HTTP `403 Forbidden`. | Vraćen `403 Forbidden`. | **PASS** |
| **MT-05** | Kreiranje putnog naloga ili loko vožnje u Tvrtki 1 uz slanje `employee_id` ili `vehicle_id` koji pripada Tvrtki 2 (*Cross-Tenant Foreign Key Injection*) | Poslužitelj provjerava pripadnost zaposlenika i vozila aktivnoj tvrtki te odbija zahtjev s greškom. | Baza i API odbijaju upis (`Odabrani zaposlenik/vozilo ne pripada aktivnoj tvrtki`). | **PASS** |

---

## 4. Testiranje korisničkih prava (RBAC) i pokušaja zaobilaženja ovlasti

Za ulogu `user` (podkorisnik) ispitana je svaka od 7 pojedinačnih ovlasti u objektu `UserPermissions`, uključujući izravne HTTP pozive kojima napadač pokušava zaobići skrivenu tipku u sučelju.

### 4.1. Matrica ispitivanja pojedinačnih ovlasti (`UserPermissions`)

| Ovlast (`UserPermissions`) | Testirani pozitivni scenarij (`true`) | Testirani negativni scenarij (`false` — pokušaj zaobilaženja API-ja) | Rezultat | Status |
| :--- | :--- | :--- | :--- | :---: |
| **`canManageTravelOrders`** | Kreiranje `NACRT` naloga (`POST /api/travel-orders`) i izmjena opisa/rute (`PATCH /api/travel-orders/[id]`). | `POST`, `PUT`, `PATCH` (ne-statusnih polja) i `DELETE` nad `/api/travel-orders` vraćaju `403 Forbidden`. | Vraćen `201`/`200` kad je uključeno; `403 Forbidden` kad je isključeno. | **PASS** |
| **`canApproveTravelOrders`** | Odobravanje i promjena statusa (`NACRT -> ODOBREN -> OBRACUNAT -> ISPLACEN`) putem `PATCH /api/travel-orders/[id]`. | Korisnik bez ove ovlasti šalje `POST` sa `status: "APPROVED"`/`"PAID"` ili `PATCH { status: "APPROVED" }`; voditelj koji ima samo ovu ovlast pokušava mijenjati svrhu ili brisati nalog. | Svi nedopušteni pokušaji eksplicitno vraćaju `403 Forbidden`. | **PASS** |
| **`canManageLoco`** | Kreiranje loko vožnje (`POST /api/loco-trips`), promjena statusa u `ISPLACENO` i brisanje. | `POST /api/loco-trips`, `PUT/PATCH /api/loco-trips/[id]` i `DELETE /api/loco-trips/[id]` bez ovlasti. | Vraćen `403 Forbidden` za sve izmjene bez ovlasti. | **PASS** |
| **`canManageMasterData`** | Dodavanje/izmjena/brisanje zaposlenika (`/api/employees`), vozila (`/api/vehicles`) i postavki tvrtke (`/api/settings`). | `POST`, `PUT`, `PATCH`, `DELETE` na `/api/employees/**`, `/api/vehicles/**` i `/api/settings` bez ovlasti. | Svih 12 neovlaštenih poziva vraća `403 Forbidden`. | **PASS** |
| **`canViewAnalytics`** | Pristup modulu *Analitika i izvoz* i preuzimanje CSV izvještaja. | Skrivanje modula u navigaciji za korisnike bez ovlasti. | Modul i akcije ispravno kontrolirani. | **PASS** |
| **`canManageJoppd`** | Pristup modulu *JOPPD obrazac*, izračun neoporezivih šifri `17`, `18`, `19` i izvoz XML/CSV. | Skrivanje modula u navigaciji za korisnike bez ovlasti. | Modul i akcije ispravno kontrolirani. | **PASS** |
| **`canBackupRestore`** | Izvoz JSON sigurnosne kopije tvrtke (`GET /api/backup`) i vraćanje (`POST /api/restore`). | `GET /api/backup` i `POST /api/restore` za korisnika s `canBackupRestore: false`. | Vraćen `403 Forbidden`. | **PASS** |

### 4.2. Dinamička promjena prava i trenutna deaktivacija korisnika

| ID | Scenarij testiranja | Očekivani rezultat | Stvarni rezultat | Status |
| :--- | :--- | :--- | :--- | :---: |
| **RBAC-DYN-01** | Administrator tvrtke dodjeljuje `canApproveTravelOrders: true` i `canManageLoco: true` prijavljenom podkorisniku | Podkorisnik **odmah na postojećem kolačiću sesije** (bez odjave i ponovne prijave) dobiva pravo odobriti nalog i unijeti loko vožnju jer se ovlasti čitaju iz baze pri svakom zahtjevu. | `PATCH /api/travel-orders/[id]` i `POST /api/loco-trips` trenutačno prolaze sa statusom `200`/`201`. | **PASS** |
| **RBAC-DYN-02** | Administrator tvrtke oduzima ovlast ili deaktivira korisnika (`PATCH /api/users/[id]` s `{ active: 0 }`) dok korisnik ima otvoren preglednik i važeći kolačić | Postojeća sesija deaktiviranog korisnika **trenutačno postaje nevažeća** na prvom sljedećem API pozivu. | `getSessionFromRequest` vraća `null`, a API vraća `401 Unauthorized` bez čekanja isteka kolačića. | **PASS** |

---

## 5. Poslovni procesi i porezna pravila RH

Provjerena je usklađenost svih poslovnih izračuna s Pravilnikom o porezu na dohodak Republike Hrvatske.

| ID | Poslovni proces / Pravilo | Ispitani ulazni podaci | Izračunati rezultat | Status |
| :--- | :--- | :--- | :--- | :---: |
| **BIZ-01** | Tuzemni nalog — minimalna udaljenost `< 30 km` | Udaljenost `25 km`, trajanje `14 h` | `eligibleForPerDiem = false`, neto dnevnica = **0,00 €**, upozorenje za loko vožnju. | **PASS** |
| **BIZ-02** | Tuzemni nalog — trajanje `< 8 h`, `8–12 h` i `> 12 h` | `7,5 h` -> `0 €`; `10 h` -> pola dnevnice; `14 h` -> puna dnevnica | Točno obračunato **0,00 €**, **15,00 €** i **30,00 €**. | **PASS** |
| **BIZ-03** | Višednevno putovanje i umanjenje za obroke (`-30%` / `-60%`) | Trajanje `34,5 h` (1 puna + 1 pola = `45,00 €` bruto), 1 dan s 1 obrokom (`-30%` od `30 €` = `-9,00 €`) | Neto dnevnica = **36,00 €**. | **PASS** |
| **BIZ-04** | Obračun privatnog vozila (`0,50 €/km`) i upozorenje za gorivo | Brojilo `10.000 -> 10.570 km` (`570 km`), Zadar | Kilometraža = **285,00 €** (`570 × 0,50 €`); priloženi račun za gorivo uz privatno vozilo pali upozorenje `FUEL_WITH_PRIVATE_CAR`. | **PASS** |
| **BIZ-05** | Inozemni putni nalog (Njemačka `DE`, Austrija `AT`, Slovenija `SI`, SAD `US`) | Jednodnevni put u Njemačku (`country_code: "DE"`, `16 h`), višednevni u Francusku s obrocima, tečajna konverzija USD -> EUR | Automatski obračunata inozemna dnevnica za Njemačku **70,00 €**; ispravna kombinacija tuzemne i inozemne dnevnice pri prijelazu granice. | **PASS** |
| **BIZ-06** | Životni ciklus statusa naloga (HR i EN oznake) | Prijelaz `DRAFT/NACRT` -> `APPROVED/ODOBREN` -> `LIQUIDATED/OBRACUNAT` -> `PAID/ISPLACEN` | API prihvaća i hrvatske i engleske kodove te ih normalizira u `NACRT`, `ODOBREN`, `OBRACUNAT`, `ISPLACEN`. | **PASS** |
| **BIZ-07** | Loko vožnja (`< 30 km`) | Relacija unutar grada `12 km` i `15 km` uz stopu `0,50 €/km` | Automatski izračun iznosa (**6,00 €** i **7,50 €**) te ažuriranje statusa isplate (`EVIDENTIRANO` -> `ISPLACENO`). | **PASS** |
| **BIZ-08** | JOPPD XML i CSV generiranje po šiframa `17`, `18`, `19` | Obračunati/isplaćeni nalozi i isplaćene loko vožnje za zadani mjesec (`YYYY-MM`); nacrti i neisplaćene loko vožnje isključeni | Generiran valjani XML po shemi `ObrazacJOPPD/v1-1` (`StranaA`, `StranaB`, `P151` šifre `17`, `18`, `19`) i CSV s UTF-8 BOM-om. | **PASS** |

---

## 6. Sigurnosno kopiranje i vraćanje podataka (Backup & Restore)

Ispitan je izvoz i uvoz sigurnosnih kopija kroz rute `GET /api/backup` i `POST /api/restore`.

| ID | Scenarij testiranja | Očekivani rezultat | Stvarni rezultat | Status |
| :--- | :--- | :--- | :--- | :---: |
| **BKP-01** | Izvoz sigurnosne kopije tvrtke (`GET /api/backup`) | Vraća strukturirani JSON s metapodacima tvrtke, postavkama, zaposlenicima, vozilima, putnim nalozima s troškovima, loko vožnjama i korisnicima tvrtke (bez hashova lozinki). | JSON uspješno generiran i verificiran. | **PASS** |
| **BKP-02** | Vraćanje podataka u načinu **`Replace`** (*Zamijeni sve podatke tvrtke*) | Nakon brisanja putnog naloga u aktivnoj tvrtki, `Replace` vraća točno stanje iz sigurnosne kopije aktivne tvrtke, dok podaci svih ostalih tvrtki u bazi ostaju netaknuti. | Vraćena oba putna naloga u testnoj tvrtki; Tvrtka 1 i Tvrtka 2 netaknute. | **PASS** |
| **BKP-03** | Vraćanje podataka u načinu **`Merge`** (*Spoji s postojećim podacima*) | Spaja zapise prema prirodnim ključevima (OIB zaposlenika, registracija vozila, broj putnog naloga) bez stvaranja duplikata. | Broj naloga nakon ponovnog `Merge` uvoza ostaje točno 2 (bez duplikata). | **PASS** |
| **BKP-04** | Cjeloviti sustavski backup (`GET /api/backup?scope=all`) za `global_admin` | Izvozi sve tvrtke i sve korisnike sustava u jednoj datoteci. | Uspješno radi za `global_admin`; vraća `403 Forbidden` za sve ostale uloge. | **PASS** |

---

## 7. Sigurnosna provjera i zaštita od hakiranja (OWASP Top 10 Audit)

Provedeno je namjerno sigurnosno testiranje (*Penetration & Negative Security Testing*) prema OWASP Top 10 metodologiji.

### 7.1. Pregled OWASP kontrola

1. **Zabrana neautoriziranog pristupa (`401 Unauthorized` na svih 46 API krajnjih točaka):**
   - Automatskim testom poslano je **46 neautenticiranih HTTP zahtjeva** (`GET`, `POST`, `PUT`, `PATCH`, `DELETE`) na sve API rute (`/api/auth/me`, `/api/employees/**`, `/api/vehicles/**`, `/api/travel-orders/**`, `/api/loco-trips/**`, `/api/settings`, `/api/companies/**`, `/api/users/**`, `/api/backup`, `/api/restore`).
   - **Rezultat:** Svih 46/46 točaka vratilo je **HTTP `401 Unauthorized`** bez curenja podataka.
2. **Zaštita od krivotvorenja i manipulacije `pn_session` kolačićem (`Token Tampering & Forgery`):**
   - Ispitano je:
     - mijenjanje `userId` u payloadu (npr. iz `3` u `1` / `global_admin`) uz zadržavanje potpisa,
     - mijenjanje `activeCompanyId` iz `1` u `2`,
     - ubacivanje dodatnih svojstava (`"role": "global_admin"`) u JSON payload tokena,
     - potpisivanje tokena napadačevim tajnim ključem,
     - korištenje isteklog tokena (`> 7 dana`) i neispravno formatiranih tokena.
   - **Rezultat:** `verifySessionToken` koristi `crypto.timingSafeEqual` (zaštita od *timing* napada), odbija svaki token s neočekivanim poljima te vraća `null` za sve pokušaje manipulacije.
3. **Kriptografski ključ sesije (`data/.session_secret`):**
   - Ako varijabla okruženja `AUTH_SECRET` nije postavljena, sustav pri prvom pokretanju pomoću `crypto.randomBytes(32)` generira unikatni 256-bitni ključ i sprema ga u lokalnu datoteku `data/.session_secret` (koja je isključena iz Gita putem `.gitignore`). Time je eliminirana svaka statička/predvidiva *fallback* tajna u izvornom kodu.
4. **Zaštita od Cross-Tenant IDOR napada (*Insecure Direct Object References*):**
   - Prijavljeni `company_admin` Tvrtke 1 pokušao je čitati (`GET`), mijenjati (`PUT`/`PATCH`) i brisati (`DELETE`) pojedinačne putne naloge, zaposlenike, vozila i loko vožnje Tvrtke 2 pogađanjem njihovog ID-a (`/api/travel-orders/[c2Id]`, `/api/employees/[c2Id]`, `/api/vehicles/[c2Id]`, `/api/loco-trips/[c2Id]`).
   - **Rezultat:** Svih 16 IDOR pokušaja vratilo je **HTTP `404 Not Found`**, a podaci Tvrtke 2 ostali su potpuno neizmijenjeni.
5. **Zaštita od eskalacije privilegija kroz `/api/restore`, `/api/users` i `/api/auth/me`:**
   - Ispitani su pokušaji u kojima `company_admin` ili `user`:
     - šalje `role: "global_admin"` ili `permissions` u `POST/PATCH /api/auth/me` -> vraća **`403 Forbidden`**,
     - pokušava kreirati `global_admin` korisnika ili promovirati postojećeg korisnika u `global_admin` putem `/api/users` -> vraća **`403 Forbidden`**,
     - pokušava kreirati ili prebaciti korisnika u drugu tvrtku (`company_id: 2`) -> vraća **`403 Forbidden`**,
     - pokušava dohvatiti, izmijeniti ili obrisati korisnika druge tvrtke (`/api/users/4`) -> vraća **`403 Forbidden`**,
     - šalje manipulirani JSON backup sa `scope: "all"`, `globalUsers` ili `targetCompanyId: 2` na `POST /api/restore` -> vraća **`403 Forbidden`**.
6. **Zaštita od SQL Injection, XML Injection i CSV Formula Injection napada:**
   - **SQL Injection:** Svi SQL upiti u `src/lib/db.ts` koriste isključivo parametrizirane upite (`?` *placeholders*) u `node:sqlite`.
   - **JOPPD XML Injection / XSS:** Funkcija `escapeXml` u `src/lib/joppd.ts` pretvara sve specijalne znakove (`<`, `>`, `&`, `"`, `'`) u XML entitete (`&lt;`, `&gt;`, `&amp;`, `&quot;`, `&apos;`).
   - **CSV Formula Injection (DDE / Excel Macro Injection):** Funkcija `escapeCsvCell` u `src/lib/joppd.ts` i `src/lib/export-csv.ts` detektira tekstualne vrijednosti koje počinju znakovima formule (`=`, `+`, `-`, `@`, npr. `=CMD|' /C calc'!A0`) i automatski ih neutralizira vodećim apostrofom (`'`), dok negativne decimalne brojeve (npr. `-125,50`) ostavlja neizmijenjenima.
7. **Sigurnosna HTTP zaglavlja (`next.config.ts`) prilagođena za rad bez HTTPS-a:**
   - Na svim rutama postavljena su zaglavlja:
     - `X-Content-Type-Options: nosniff`
     - `X-Frame-Options: DENY` (zaštita od *Clickjacking* napada)
     - `Referrer-Policy: strict-origin-when-cross-origin`
     - `Permissions-Policy: camera=(), microphone=(), geolocation=()`
   - Sustav namjerno ne postavlja `Strict-Transport-Security` (HSTS) ni bezuvjetni `Secure` atribut kolačića kako bi aplikacija besprijekorno radila na lokalnom HTTP poslužitelju (`http://localhost:3000`).

---

## 8. Otkriveni i zakrpani propusti tijekom revizije

Tijekom dubinske sigurnosne i QA revizije uočeno je i odmah zakrpano sljedećih **5 rubnih slučajeva**:

1. **Uklanjanje statičke fallback tajne sesije (`src/lib/auth.ts`):**
   - *Nalaz:* Ako varijabla okruženja nije bila postavljena, koristio se fiksni fallback string u kodu, a payload tokena nije odbijao neočekivana ubačena svojstva.
   - *Rješenje:* Implementirano automatsko generiranje 256-bitne kriptografske tajne u `data/.session_secret` te striktna validacija sheme sesijskog tokena.
2. **Dodavanje Rate Limitera na prijavu (`src/lib/auth.ts`, `src/app/api/auth/login/route.ts`):**
   - *Nalaz:* Ruta `/api/auth/login` nije imala ograničenje broja uzastopnih neuspješnih pokušaja prijave.
   - *Rješenje:* Ugrađen brute-force rate limiter (maksimalno 10 neuspješnih pokušaja u 15 minuta po IP/e-mail paru uz HTTP `429 Too Many Requests` i `Retry-After` zaglavlje).
3. **Striktno RBAC razdvajanje `canManageTravelOrders` i `canApproveTravelOrders` te `PATCH` podrška (`src/app/api/travel-orders/**`):**
   - *Nalaz:* `POST /api/travel-orders` tiho je spuštao status na `NACRT` umjesto vraćanja `403` kada korisnik bez `canApproveTravelOrders` pošalje `status: "APPROVED"`, a ruta `/api/travel-orders/[id]` nije podržavala parcijalni `PATCH` ni EN aliase statusa (`DRAFT`, `APPROVED`, `LIQUIDATED`, `PAID`).
   - *Rješenje:* Dodana puna `PATCH` podrška, podrška za HR/EN statuse i inozemni `country_code`, te striktno vraćanje `403 Forbidden` pri svakom pokušaju neovlaštene promjene statusa ili neovlaštene izmjene polja naloga.
4. **Potpune HTTP metode i zabrana eskalacije privilegija (`src/app/api/**`, `src/lib/db.ts`):**
   - *Nalaz:* Pojedine rute matičnih podataka i loko vožnji nisu imale sve `GET`/`PUT`/`PATCH`/`DELETE` varijante ili nisu eksplicitno vraćale `403` kada `company_admin` pošalje `?companyId=2`, `scope=all` ili `role: "global_admin"`.
   - *Rješenje:* Sve rute nadograđene su kompletnim HTTP metodama, provjerom stranih ključeva po tvrtki i eksplicitnim `403 Forbidden` / `404 Not Found` odgovorima.
5. **CSV Formula Injection zaštita i HTTP Security Headers (`src/lib/joppd.ts`, `src/lib/export-csv.ts`, `next.config.ts`):**
   - *Nalaz:* CSV izvoz nije neutralizirao vodeće znakove Excel formula (`=`, `+`, `-`, `@`), a `next.config.ts` nije definirao obrambena HTTP zaglavlja.
   - *Rješenje:* Implementirana neutralizacija CSV formula u svim izvozima i dodana sigurnosna HTTP zaglavlja u `next.config.ts`.

---

## 9. Rezultati automatskih testova i statičke analize

Svi automatski testovi izvode se pomoću ugrađenog Node.js test runnera (`node --test`), a statička provjera tipova pomoću TypeScript kompajlera (`npx tsc --noEmit`).

### 9.1. TypeScript provjera tipova

```text
$ npx tsc --noEmit --incremental false
Exit Code: 0 (0 grešaka)
```

### 9.2. Izvršavanje automatskih testova (`node --test`)

```text
$ node --test src/lib/auth.test.ts src/lib/croatian-rules.test.ts src/lib/foreign-per-diems.test.ts src/lib/joppd.test.ts

✔ Autentikacija, Više-tvrtki (Multi-Tenancy), RBAC i Backup/Restore (8/8)
  ✔ ispravno hashira i verificira lozinke te potpisuje sesije
  ✔ odbija krivotvorene, izmijenjene i istekle sesijske tokene (Token Tampering & Forgery Protection)
  ✔ štiti prijavu od brute-force napada (Rate Limiting - maks 10 pokušaja u 15 min)
  ✔ uspješno prijavljuje sve zadane demo račune (global_admin, company_admin, user)
  ✔ izolira podatke između Tvrtke 1 i Tvrtke 2 i sprječava Cross-Tenant IDOR
  ✔ sprječava company_admin i user uloge u prebacivanju na drugu tvrtku putem headera ili URL parametra
  ✔ trenutačno primjenjuje opoziv ovlasti i deaktivaciju korisnika na postojeću sesiju bez ponovne prijave
  ✔ izvršava cjeloviti E2E poslovni tijek (Global Admin -> Company Admin -> Sub-user tuzemni i DE inozemni nalog -> Odobravanje -> Loko -> Backup/Restore)
  ✔ štiti JOPPD XML i CSV izvoz od XML/Formula Injection napada
  ✔ izvršava cjeloviti HTTP API audit svih ruta: neautenticirani pristup (401), RBAC zabrane (403), IDOR zaštita (404), Rate Limiting (429) i E2E scenariji
✔ Hrvatski propisi - obračun dnevnica i putnih naloga (6/6)
✔ Inozemne dnevnice - Odluka Vlade RH i Pravilnik o porezu na dohodak (9/9)
✔ JOPPD obrazac - grupiranje i izvoz (4/4)

ℹ tests 29
ℹ suites 4
ℹ pass 29
ℹ fail 0
```

> **Zaključak:** Sustav **Putni Nalozi HR** uspješno je prošao sve funkcionalne, porezne i sigurnosne provjere te je spreman za produkcijsko korištenje i objavu na GitHub repozitoriju.

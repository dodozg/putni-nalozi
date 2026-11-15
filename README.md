# Putni Nalozi HR — Višekorisnička web aplikacija po hrvatskim propisima

Moderna **multi-tenant (više tvrtki)** i **višekorisnička (RBAC)** web aplikacija za vođenje i obračun **tuzemnih i inozemnih putnih naloga**, **loko vožnje**, pripremu **JOPPD obrazaca** te **sigurnosno kopiranje podataka (Backup & Restore)** u Republici Hrvatskoj, usklađena s važećim **Pravilnikom o porezu na dohodak**.

> 📖 **Detaljna korisnička i tehnička dokumentacija:**
> Cjelovite upute za rad po ulogama, opis svih prava pristupa, upute za Backup & Restore te pregled API-ja potražite u datoteci **[DOKUMENTACIJA.md](./DOKUMENTACIJA.md)**.
> 🛡️ **Izvješće o testiranju i sigurnosnom auditu:**
> Rezultate funkcionalnog, RBAC i sigurnosnog (OWASP Top 10) testiranja potražite u datoteci **[IZVJESCE_O_TESTIRANJU.md](./IZVJESCE_O_TESTIRANJU.md)**.

---

## Ključne funkcionalnosti

- **Rad s više tvrtki (Multi-Tenant arhitektura):**
  - Vođenje neograničenog broja tvrtki u istoj aplikaciji uz potpunu izolaciju podataka (svaka tvrtka ima vlastite zaposlenike, vozila, putne naloge, loko vožnje, postavke i JOPPD izvještaje).
  - Brzo prebacivanje aktivne tvrtke u zaglavlju aplikacije (*Aktivna tvrtka*) za Globalnog Admina.
- **Korisničke uloge i granularna prava pristupa (RBAC):**
  - **Globalni Admin (`global_admin`):** upravlja svim tvrtkama, svim korisnicima i cjelovitim sustavskim sigurnosnim kopijama.
  - **Administrator tvrtke (`company_admin`):** direktor ili šef računovodstva pojedine tvrtke — upravlja podacima svoje tvrtke, kreira **podkorisnike** i uključuje/isključuje im pojedinačna prava pristupa.
  - **Korisnik / Podkorisnik (`user`):** djelatnik, voditelj ili računovođa s precizno dodijeljenim ovlastima (`canManageTravelOrders`, `canApproveTravelOrders`, `canManageLoco`, `canManageMasterData`, `canViewAnalytics`, `canManageJoppd`, `canBackupRestore`).
- **Tuzemni i inozemni putni nalozi:**
  - Provjera minimalne udaljenosti od **30 km** za pravo na neoporezivu tuzemnu dnevnicu.
  - Automatski izračun sati puta: `> 12 h` = **30,00 €**, `8–12 h` = **15,00 €**, `< 8 h` = **0,00 €** (uz višednevna putovanja po svakih započetih 24 sata).
  - Umanjenje dnevnice za osigurane besplatne obroke (**-30%** za 1 obrok, **-60%** za 2 obroka).
  - Kalkulator i obračun **inozemnih dnevnica** prema propisanim državnim stopama.
  - Interaktivna karta međugradskih ruta i cestarina u RH te provjera zakonske usklađenosti uživo.
- **Korištenje privatnog automobila i Loko vožnja:**
  - Neoporeziva naknada **0,50 €/km** uz obavezno praćenje početnog i završnog stanja brojila.
  - Zaseban modul za **Loko vožnju** (`< 30 km`) s ispisom mjesečnog izvješća.
- **Službeni A4 ispis / PDF obrazac, JOPPD i Analitika:**
  - Dvostrani A4 ispis (*Nalog za službeno putovanje* + *Obračun putnih troškova* s 3 potpisne linije).
  - Automatsko generiranje **JOPPD XML** i **CSV** datoteka (šifre neoporezivih primitaka `17`, `18`, `19`) za ePoreznu.
  - Grafička analitika troškova po mjesecima, zaposlenicima i vozilima te izvoz u Excel CSV.
- **Sigurnosna kopija i vraćanje podataka (Backup & Restore):**
  - Jednostavan JSON izvoz podataka aktivne tvrtke ili cijelog sustava.
  - Vraćanje podataka uz odabir načina **Spoji s postojećim podacima (Merge)** ili **Zamijeni sve podatke tvrtke (Replace)**.

---

## Preddefinirani demo računi za testiranje

U razvojnom načinu rada (`npm run dev` / `pokreni.bat`) na ekranu prijave prikazane su kartice za brzu prijavu jednim klikom pomoću ugrađenih demo računa. U **produkcijskom načinu rada** (`npm run build && npm start` / `pokreni-produkciju.bat`, ili uz `NEXT_PUBLIC_HIDE_DEMO_ACCOUNTS=true`) kartice s demo računima na ekranu prijave **automatski su skrivene**, a prije produkcijskog korištenja u tvrtki preporučuje se promijeniti zadanu lozinku glavnog administratora (`admin@sustav.hr`) te deaktivirati ili obrisati testne demo račune.

| Uloga | Tvrtka | E-mail | Lozinka |
| :--- | :--- | :--- | :--- |
| **Globalni Admin** (`global_admin`) | Sve tvrtke u sustavu | `admin@sustav.hr` | `admin123` |
| **Administrator tvrtke 1** (`company_admin`) | Adriatik Tehnologije d.o.o. | `direktor@firma1.hr` | `firma123` |
| **Podkorisnik tvrtke 1** (`user`) | Adriatik Tehnologije d.o.o. | `korisnik@firma1.hr` | `korisnik123` |
| **Administrator tvrtke 2** (`company_admin`) | Slavonija Logistika d.o.o. | `direktor@firma2.hr` | `firma234` |

---

## Tehnologije

- **Next.js 16** (App Router, React 19, TypeScript)
- **Tailwind CSS 4**
- **SQLite** (ugrađeni `node:sqlite` — bez potrebe za vanjskim bazama podataka, pohrana u `data/putni_nalozi.db`)

---

## Instalacija i pokretanje aplikacije

### Preduvjeti (Sustavski zahtjevi)

- **Node.js `>= 22.5.0`** (preporučeno **Node.js 22 LTS** ili **24**). Aplikacija koristi ugrađeni **`node:sqlite`** modul, što znači da **nisu potrebni** nikakvi vanjski C++ kompajleri (Visual Studio Build Tools, Python, `node-gyp`) niti vanjski SQL poslužitelj — `npm install` radi čisto i brzo na svakom operacijskom sustavu.
- **Git** (za kloniranje repozitorija).

### Instalacija (prvo preuzimanje na računalo ili poslužitelj)

```bash
git clone https://github.com/dodozg/putni-nalozi.git
cd putni-nalozi
npm install
```

### Pokretanje aplikacije (3 opcije ovisno o načinu rada)

- **Opcija A (Windows — brzo pokretanje jednim klikom za lokalni rad):**
  - U korijenskoj mapi projekta nalazi se univerzalna skripta **`pokreni.bat`** (koristi relativnu putanju `%~dp0` pa radi na svakom računalu bez obzira na mapu u koju je projekt preuzet).
  - Dvoklikom na `pokreni.bat` skripta provjerava jesu li instalirane ovisnosti (`node_modules`), po potrebi pokreće `npm install`, otvara `http://localhost:3000` u pregledniku i pokreće poslužitelj.
  - *Savjet za prečac na radnoj površini (Desktop):* Desni klik na `pokreni.bat` -> *Prikaži više opcija* -> *Pošalji na* -> *Radna površina (stvori prečac)*.
- **Opcija B (Terminal — razvojni način rada na Windows / macOS / Linux):**
  ```bash
  npm run dev
  ```
  Aplikacija je dostupna na `http://localhost:3000`. Prilikom prvog pokretanja automatski se kreira lokalna SQLite baza (`./data/putni_nalozi.db`) s početnim demo tvrtkama, podacima i korisničkim računima.
- **Opcija C (Produkcijski način rada — za stalni rad na poslužitelju u tvrtki i pristup više korisnika u lokalnoj mreži):**
  - Kroz terminal:
    ```bash
    npm run build
    npm start
    ```
  - Ili jednim klikom na Windows poslužitelju pomoću skripte **`pokreni-produkciju.bat`** (automatski izvršava `npm install` i `npm run build` ako već nisu odrađeni te pokreće produkcijski poslužitelj `npm start`).
  - *Sigurnosna napomena za produkciju:* U produkcijskom načinu rada (`NODE_ENV=production`) kartice za brzu prijavu demo računima na ekranu prijave automatski su skrivene. Prije početka produkcijskog rada prijavite se kao `admin@sustav.hr` i promijenite zadanu lozinku (`admin123`) u modulu *Tvrtke, korisnici i prava*.

### Pristup više korisnika preko lokalne mreže (LAN) / poslužitelja

- Kada je aplikacija pokrenuta na jednom računalu ili internom poslužitelju u uredu, sva ostala računala u istoj lokalnoj mreži (LAN / Wi-Fi) mogu joj istovremeno pristupati putem web preglednika pomoću **mrežnog URL-a** (*Network*) koji Next.js ispiše u terminalu pri pokretanju (npr. `http://192.168.1.50:3000`).
- Ako se druga računala u mreži ne mogu spojiti, u **Windows vatrozidu (Windows Defender Firewall)** na računalu-poslužitelju potrebno je dopustiti dolazni pristup za **Node.js** ili TCP port **`3000`** unutar privatne mreže.

## Sigurnosna zaštita sustava (OWASP Top 10)

- **Zaštita prijave (Brute-Force Rate Limiting):** Ograničenje na maksimalno 10 neuspješnih pokušaja prijave u 15 minuta po IP/e-mail paru (`429 Too Many Requests` + `Retry-After`).
- **Kriptografska zaštita lozinki i sesija (`pn_session`):** Hashiranje lozinki pomoću `scryptSync` sa slučajnim *saltom*, potpisivanje sesije s 256-bitnim HMAC-SHA256 ključem (`data/.session_secret`), `crypto.timingSafeEqual` verifikacija te `HttpOnly` i `SameSite=Lax` zaštita prilagođena za rad i na lokalnom HTTP poslužitelju bez HTTPS-a.
- **Višetvrtkovna izolacija, RBAC i zaštita od IDOR napada:** Striktna provjera pripadnosti tvrtki (`activeCompanyId`) i pojedinačnih ovlasti (`UserPermissions`) na svim API rutama, zabrana eskalacije privilegija kroz `/api/users`, `/api/auth/me` i `/api/restore`, te trenutni opoziv sesije pri deaktivaciji korisnika.
- **Zaštita od SQL, XML i CSV Formula Injection napada:** Parametrizirani SQLite upiti (`?`), `escapeXml` zaštita na JOPPD XML obrascima te `escapeCsvCell` zaštita od izvršavanja formula (`=`, `+`, `-`, `@`) u CSV izvozima.
- **Sigurnosna HTTP zaglavlja (`next.config.ts`):** `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin` i `Permissions-Policy`.

---

## Testiranje porezne, JOPPD, višekorisničke (RBAC / Backup) i sigurnosne logike

```bash
node --test src/lib/*.test.ts
```

---

Za detaljne upute o korištenju svih modula, administraciji tvrtki i korisnika te izradi sigurnosnih kopija pročitajte **[DOKUMENTACIJA.md](./DOKUMENTACIJA.md)**, a detalje provedenih sigurnosnih i funkcionalnih testova pogledajte u **[IZVJESCE_O_TESTIRANJU.md](./IZVJESCE_O_TESTIRANJU.md)**.

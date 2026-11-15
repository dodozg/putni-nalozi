# Korisnička i tehnička dokumentacija — Sustav Putni Nalozi HR

Dobrodošli u službenu dokumentaciju i korisnički priručnik web aplikacije **Putni Nalozi HR** — višekorisničkog (*multi-user*) i višetvrtkovnog (*multi-tenant*) sustava za evidenciju, obračun i ispis službenih putovanja te loko vožnji, u potpunosti usklađenog s važećim **Pravilnikom o porezu na dohodak Republike Hrvatske**.

---

## Sadržaj

1. [Pregled sustava](#1-pregled-sustava)
2. [Instalacija i pokretanje aplikacije](#2-instalacija-i-pokretanje-aplikacije)
3. [Prijava i korisničke uloge (RBAC)](#3-prijava-i-korisničke-uloge-rbac)
4. [Upute za korištenje po ulogama i modulima](#4-upute-za-korištenje-po-ulogama-i-modulima)
5. [Sigurnosna kopija i vraćanje podataka (Backup & Restore)](#5-sigurnosna-kopija-i-vraćanje-podataka-backup--restore)
6. [Tehnička arhitektura i API pregled](#6-tehnička-arhitektura-i-api-pregled)
7. [Sigurnosna arhitektura i zaštita sustava (OWASP Top 10)](#7-sigurnosna-arhitektura-i-zaštita-sustava-owasp-top-10)

---

## 1. Pregled sustava

Aplikacija **Putni Nalozi HR** omogućuje istovremeno vođenje evidencije službenih putovanja za **više neovisnih tvrtki (Multi-Tenant arhitektura)** unutar jedne instalacije, uz potpunu izolaciju podataka po tvrtkama i preciznu kontrolu prava pristupa (**RBAC — Role-Based Access Control**).

### Ključne značajke sustava

- **Rad s više tvrtki (Multi-Tenancy):** Svaka tvrtka u sustavu ima vlastite matične podatke (OIB, adresu, IBAN, odgovornu osobu, prefiks naloga i porezne stope), vlastite zaposlenike, vozila, putne naloge i evidenciju loko vožnji. Podaci jedne tvrtke potpuno su odvojeni od podataka drugih tvrtki.
- **Višekorisnički rad i hijerarhija uloga:** Sustav podržava tri razine korisnika (**Globalni Admin**, **Administrator tvrtke / Lokalni Admin** i **Korisnik / Podkorisnik**) uz 7 pojedinačnih (granularnih) prava pristupa koja se mogu uključiti ili isključiti za svakog podkorisnika.
- **Automatski obračun prema propisima RH:**
  - Provjera minimalne udaljenosti (`≥ 30 km`) za ostvarivanje prava na neoporezivu tuzemnu dnevnicu.
  - Automatski izračun trajanja putovanja i broja dnevnica (`8–12 h` = pola dnevnice **15,00 €**, `> 12 h` = puna dnevnica **30,00 €**).
  - Automatsko umanjenje dnevnice za osigurane besplatne obroke (**-30%** za jedan obrok, **-60%** za dva obroka).
  - Obračun naknade za korištenje privatnog automobila u službene svrhe (**0,50 €/km**) uz praćenje početnog i završnog stanja brojila.
- **Pregled modula aplikacije (navigacijske skupine):**
  1. **Evidencija i obračun:**
     - **Putni nalozi** — tuzemni putni nalozi, interaktivna karta ruta i cestarina u RH, provjera zakonske usklađenosti i A4 ispis.
     - **Inozemni nalozi** — kalkulator i obračun inozemnih dnevnica prema službenim stopama po državama svijeta.
     - **Loko vožnja** — evidencija gradskih i lokalnih vožnji (`< 30 km`) s obračunom naknade po kilometru i ispisom mjesečnog izvješća.
  2. **Izvještaji i Porezna:**
     - **JOPPD obrazac** — automatska priprema neoporezivih primitaka po šiframa `17`, `18` i `19` te preuzimanje **XML** i **CSV** datoteka za sustav ePorezna.
     - **Analitika i izvoz** — grafički i tablični pregled troškova po mjesecima, zaposlenicima i vozilima uz izvoz u Excel CSV.
  3. **Upravljanje i sustav:**
     - **Tvrtka, radnici i vozila** — matični podaci aktivne tvrtke, zakonske stope, evidencija zaposlenika i voznog parka.
     - **Tvrtke, korisnici i prava** *(ili **Korisnici i ovlasti**)* — administracija tvrtki, korisničkih računa i pojedinačnih prava pristupa.
     - **Sigurnosna kopija (Backup)** — izvoz podataka tvrtke ili cijelog sustava u `.json` format te vraćanje podataka (*Merge* ili *Replace*).

---

## 2. Instalacija i pokretanje aplikacije

### 2.1. Preduvjeti (Sustavski zahtjevi)

- **Node.js `>= 22.5.0`** (preporučeno **Node.js 22 LTS** ili **24**).
  - *Zašto Node.js 22.5+?* Aplikacija koristi službeni ugrađeni **`node:sqlite`** modul koji je dio samog Node.js okruženja. Zahvaljujući tome **nisu potrebni** nikakvi vanjski C++ kompajleri (Visual Studio Build Tools, Python, `node-gyp`) niti vanjski SQL poslužitelj — naredba `npm install` izvršava se čisto i brzo na svakom operacijskom sustavu (Windows, macOS, Linux).
- **Git** (za kloniranje repozitorija s GitHuba).

### 2.2. Instalacija (prvo preuzimanje na računalo ili poslužitelj)

Otvorite terminal (PowerShell, Command Prompt ili Bash) u mapi u koju želite preuzeti projekt i pokrenite:

```bash
git clone https://github.com/dodozg/putni-nalozi.git
cd putni-nalozi
npm install
```

### 2.3. Pokretanje aplikacije (3 opcije ovisno o načinu rada)

#### Opcija A (Windows — brzo pokretanje jednim klikom za lokalni rad)

1. U korijenskoj mapi projekta nalazi se univerzalna skripta **`pokreni.bat`** (koristi relativnu putanju `%~dp0` pa radi na svakom Windows računalu bez obzira na to gdje se mapa projekta nalazi).
2. Dvaput kliknite na **`pokreni.bat`** — skripta automatski provjerava jesu li instalirane ovisnosti (`node_modules/`), po potrebi pri prvom pokretanju izvršava `npm install`, otvara web preglednik na adresi `http://localhost:3000` i pokreće poslužitelj.
3. Dok radite u aplikaciji, ostavite prozor terminala otvorenim u pozadini.
4. *Savjet za prečac na radnoj površini (Desktop):* Kliknite desnim klikom miša na datoteku `pokreni.bat` -> *Prikaži više opcija* -> *Pošalji na* -> *Radna površina (stvori prečac)*. Time dobivate ikonu na Desktopu na bilo kojem računalu.

#### Opcija B (Terminal — razvojni način rada na Windows / macOS / Linux)

```bash
npm run dev
```

Nakon pokretanja otvorite preglednik na adresi **`http://localhost:3000`**.

#### Opcija C (Produkcijski način rada — za stalni rad na poslužitelju u tvrtki i pristup više korisnika u lokalnoj mreži)

Za maksimalne performanse pri stalnom višekorisničkom radu u uredu ili na poslužitelju tvrtke:

- **Kroz terminal (Windows / macOS / Linux):**
  ```bash
  npm run build
  npm start
  ```
- **Jednim klikom na Windows poslužitelju (`pokreni-produkciju.bat`):**
  Dvaput kliknite na skriptu **`pokreni-produkciju.bat`** u korijenskoj mapi projekta — skripta po potrebi instalira ovisnosti (`npm install`), gradi optimiziranu produkcijsku verziju (`npm run build`), otvara `http://localhost:3000` i pokreće produkcijski poslužitelj (`npm start`).

### 2.4. Pristup više korisnika preko lokalne mreže (LAN) / poslužitelja

- Aplikacija je višekorisnička i može se pokrenuti na jednom središnjem računalu ili internom poslužitelju u uredu, dok joj svi ostali djelatnici, voditelji i računovodstvo pristupaju sa svojih računala preko lokalne mreže (LAN / Wi-Fi).
- Pri pokretanju poslužitelja Next.js u terminalu ispisuje dvije adrese:
  - `Local: http://localhost:3000` (za rad na samom računalu na kojem je poslužitelj pokrenut)
  - `Network: http://192.168.x.x:3000` (mrežni URL za ostala računala u istoj mreži)
- Ostali korisnici u uredu u svoj web preglednik upisuju navedeni mrežni URL (npr. `http://192.168.1.50:3000`) i prijavljuju se svojim korisničkim računom.
- **Napomena za Windows vatrozid (Firewall):** Ako se druga računala u lokalnoj mreži ne mogu spojiti na poslužitelj, u postavkama *Windows Defender Firewalla* na računalu-poslužitelju potrebno je dopustiti dolazni promet za **Node.js** (ili otvoriti dolazni TCP port **`3000`** za privatnu mrežu).

> [!NOTE]
> Prilikom prvog pokretanja sustav automatski inicijalizira lokalnu SQLite bazu podataka u mapi `./data/putni_nalozi.db` te kreira preddefinirane demo tvrtke, zaposlenike, vozila, putne naloge i demo korisničke račune kako biste odmah mogli testirati sve funkcionalnosti.

---

## 3. Prijava i korisničke uloge (RBAC)

При otvaranju aplikacije prikazuje se zaslon **`Prijava u sustav Putni Nalozi`**. Prijaviti se možete unosom e-mail adrese i lozinke ili jednim klikom na neku od kartica u sekciji **„Demo računi za testiranje uloga i tvrtki“**.

### 3.1. Pregled korisničkih uloga

Sustav razlikuje tri uloge korisnika:

| Uloga u sustavu | Oznaka u sučelju | Opis i opseg ovlasti |
| :--- | :--- | :--- |
| **`global_admin`** | **Globalni Admin** | Najviša razina pristupa u sustavu. Vidi i upravlja **svim tvrtkama**, može se u zaglavlju aplikacije prebacivati između tvrtki (*Aktivna tvrtka*), kreirati nove tvrtke, dodjeljivati lokalne administratore tvrtkama, upravljati svim korisnicima te izrađivati i vraćati sigurnosnu kopiju pojedine tvrtke ili **cijelog sustava**. |
| **`company_admin`** | **Administrator tvrtke** | Lokalni administrator pojedine tvrtke (npr. **direktor** ili **šef računovodstva**). Ima sva prava unutar svoje tvrtke: uređuje matične podatke tvrtke, samostalno kreira **podkorisnike** svoje tvrtke (računovodstvo, voditelje, djelatnike), dodjeljuje im pojedinačna prava pristupa te izrađuje sigurnosne kopije svoje tvrtke. Ne vidi podatke drugih tvrtki. |
| **`user`** | **Korisnik (Podkorisnik)** | Djelatnik, voditelj odjela ili referent unutar jedne tvrtke. Pristupa isključivo podacima svoje tvrtke i vidi samo one module i akcije za koje mu je **Administrator tvrtke** (ili Globalni Admin) uključio pojedinačna prava pristupa. |

---

### 3.2. Tablica pojedinačnih prava pristupa (`UserPermissions`)

Za uloge **Globalni Admin** (`global_admin`) i **Administrator tvrtke** (`company_admin`) sva su prava pristupa automatski uključena. Za ulogu **Korisnik / Podkorisnik** (`user`), administrator tvrtke može pojedinačno uključiti ili isključiti bilo koje od sljedećih **7 prava pristupa**:

| Tehnički ključ prava | Naziv u sučelju | Što pravo omogućuje u aplikaciji | Zadano za novog djelatnika |
| :--- | :--- | :--- | :---: |
| `canManageTravelOrders` | **Upravljanje putnim nalozima** | Kreiranje novih (`+ Novi putni nalog`), uređivanje postojećih i brisanje tuzemnih putnih naloga te korištenje kalkulatora inozemnih naloga. Ako je isključeno, korisnik može samo pregledavati i ispisivati naloge. | **DA** (`true`) |
| `canApproveTravelOrders` | **Odobravanje i isplata naloga** | Promjena statusa putnog naloga u **Odobren**, **Obračunat** i **Isplaćen** (u tablici naloga i unutar obrasca putnog naloga). Bez ovog prava korisnik može spremiti nalog samo kao **Nacrt**. | **NE** (`false`) |
| `canManageLoco` | **Upravljanje loco vožnjama** | Pristup modulu **Loko vožnja**, unos novih gradskih/lokalnih vožnji, označavanje statusa isplate i brisanje zapisa. Ako je isključeno, kartica *Loko vožnja* je skrivena. | **DA** (`true`) |
| `canManageMasterData` | **Matični podaci i postavke** | Pristup modulu **Tvrtka, radnici i vozila** — uređivanje podataka tvrtke, IBAN-a, prefiksa naloga, zakonskih stopa dnevnica/kilometraže te dodavanje i deaktivacija zaposlenika i vozila. | **NE** (`false`) |
| `canViewAnalytics` | **Analitika i izvještaji** | Pristup modulu **Analitika i izvoz** — pregled grafova, statistike troškova po mjesecima, radnicima i vozilima te preuzimanje CSV izvještaja (`Preuzmi Excel CSV`). | **DA** (`true`) |
| `canManageJoppd` | **JOPPD obrasci** | Pristup modulu **JOPPD obrazac** — pregled neoporezivih primitaka po šiframa (17, 18, 19) te generiranje i preuzimanje JOPPD XML i CSV datoteka za Poreznu upravu. | **NE** (`false`) |
| `canBackupRestore` | **Sigurnosna kopija / Backup** | Pristup modulu **Sigurnosna kopija (Backup)** — preuzimanje JSON sigurnosne kopije podataka tvrtke i vraćanje podataka iz sigurnosne kopije. | **NE** (`false`) |

#### Brzi predlošci ovlasti pri kreiranju podkorisnika

Prilikom dodavanja novog podkorisnika, administrator može jednim klikom odabrati jedan od tri gotova predloška ovlasti te ih po potrebi dodatno prilagoditi:
- **Djelatnik (osnovno):** uključeno *Upravljanje putnim nalozima*, *Upravljanje loco vožnjama* i *Analitika i izvještaji*.
- **Voditelj (odobravanje):** sve što ima Djelatnik + uključeno *Odobravanje i isplata naloga* (`canApproveTravelOrders`).
- **Računovodstvo (sve):** uključena sva 7 prava pristupa unutar tvrtke (uključujući *JOPPD obrasce*, *Matične podatke* i *Sigurnosnu kopiju*).

---

### 3.3. Preddefinirani demo računi za testiranje

Sustav dolazi s 4 unaprijed pripremljena demo računa koje na ekranu prijave možete odabrati jednim klikom:

| Naziv demo računa | Uloga | Tvrtka | E-mail adresa | Lozinka |
| :--- | :--- | :--- | :--- | :--- |
| **Globalni Admin** | `global_admin` (*Globalni Admin*) | Sve tvrtke u sustavu | `admin@sustav.hr` | `admin123` |
| **Lokalni Admin Firme 1** | `company_admin` (*Administrator tvrtke*) | Adriatik Tehnologije d.o.o. (Zagreb) | `direktor@firma1.hr` | `firma123` |
| **Podkorisnik Firme 1** | `user` (*Korisnik / Djelatnik*) | Adriatik Tehnologije d.o.o. (Zagreb) | `korisnik@firma1.hr` | `korisnik123` |
| **Lokalni Admin Firme 2** | `company_admin` (*Administrator tvrtke*) | Slavonija Logistika d.o.o. (Osijek) | `direktor@firma2.hr` | `firma234` |

---

## 4. Upute za korištenje po ulogama i modulima

### 4.1. Globalni Admin — Upravljanje tvrtkama i prebacivanje konteksta

Kada ste prijavljeni kao **Globalni Admin** (`admin@sustav.hr`):

1. **Prebacivanje između tvrtki u zaglavlju (*Aktivna tvrtka*):**
   - U gornjem desnom dijelu zaglavlja nalazi se padajući izbornik **`Aktivna tvrtka:`**.
   - Odabirom druge tvrtke iz padajućeg izbornika (npr. prelazak s *Adriatik Tehnologije d.o.o.* na *Slavonija Logistika d.o.o.*), cijelo sučelje (putni nalozi, zaposlenici, vozila, loko vožnje, JOPPD, analitika) trenutačno se prebacuje na podatke odabrane tvrtke.
2. **Dodavanje nove tvrtke u sustav:**
   - U lijevom navigacijskom izborniku pod skupinom *Upravljanje i sustav* kliknite na **`Tvrtke, korisnici i prava`**.
   - U gornjem desnom kutu modula prebacite podkarticu na **`Tvrtke`**.
   - Kliknite gumb **`+ Dodaj novu tvrtku`** i popunite podatke:
     - *Naziv tvrtke* i *OIB tvrtke* (11 znamenki — obavezno)
     - *IBAN račun*, *Adresa sjedišta*, *Grad i poštanski broj*, *Odgovorna osoba (Direktor)* i *Prefiks naloga* (npr. `PN`).
   - Kliknite **`Spremi novu tvrtku`**. Sustav automatski kreira tvrtku i njezine početne zakonske postavke.
   - Na kartici svake tvrtke možete kliknuti **`Prebaci u ovu tvrtku`** za izravan ulazak u njezin radni prostor, **`Uredi`** za izmjenu podataka ili **`Aktiviraj / Deaktiviraj`**.
3. **Dodjela lokalnog administratora tvrtki:**
   - Na podkartici **`Korisnici i prava`** kliknite **`+ Novi korisnik`**.
   - Unesite ime i prezime, e-mail adresu i početnu lozinku.
   - U polju **Tvrtka** odaberite željenu tvrtku, a u polju **Uloga u sustavu** odaberite **`Administrator tvrtke (Direktor / Računovodstvo)`**.
   - Spremanjem obrasca taj korisnik postaje lokalni administrator odabrane tvrtke.

---

### 4.2. Lokalni Admin tvrtke — Upravljanje podkorisnicima, ovlastima i postavkama

Kada ste prijavljeni kao **Administrator tvrtke** (npr. `direktor@firma1.hr` ili `direktor@firma2.hr`):

1. **Dodavanje podkorisnika (računovodstvo, voditelji, djelatnici):**
   - U lijevom izborniku otvorite **`Korisnici i ovlasti`**.
   - Kliknite gumb **`+ Dodaj podkorisnika tvrtke`**.
   - Unesite *Ime i prezime*, *E-mail adresu za prijavu* i *Početnu lozinku*.
   - Odaberite ulogu:
     - **`Korisnik / Podkorisnik (Granularne ovlasti)`** — za djelatnike, voditelje ili računovodstvo kojima želite prilagoditi ovlasti.
     - **`Administrator tvrtke (Direktor / Računovodstvo)`** — ako osobi želite dati pune administrativne ovlasti unutar vaše tvrtke.
   - Za podkorisnika odaberite brzi predložak (*Djelatnik (osnovno)*, *Voditelj (odobravanje)* ili *Računovodstvo (sve)*) ili ručno označite željene kvačice pod **Prava pristupa modulima (`UserPermissions`)**, pa kliknite **`Kreiraj korisnički račun`**.
2. **Trenutna izmjena prava pristupa i lozinki postojećim korisnicima:**
   - U popisu korisnika vaše tvrtke, pokraj svakog podkorisnika prikazano je 7 gumba za pojedinačne ovlasti (*Upravljanje putnim nalozima*, *Odobravanje i isplata naloga*, *Upravljanje loco vožnjama*, *Matični podaci i postavke*, *Analitika i izvještaji*, *JOPPD obrasci*, *Sigurnosna kopija / Backup*).
   - **Jednim klikom** na bilo koju ovlast odmah je uključujete (zelena kvačica) ili isključujete (sivo) za tog korisnika.
   - Pomoću gumba **`Lozinka`** možete korisniku u svakom trenutku postaviti novu lozinku, a pomoću **`Deaktiviraj`** privremeno onemogućiti prijavu.
3. **Uređivanje postavki tvrtke i stopa dnevnica/kilometraže:**
   - Otvorite modul **`Tvrtka, radnici i vozila`** u lijevom izborniku.
   - U gornjoj kartici **Postavke tvrtke i zakonske stope** uredite naziv, OIB, adresu, grad, IBAN, ime direktora, prefiks putnih naloga te stope:
     - *Puna dnevnica (> 12 h)*: zadano **30,00 €**
     - *Pola dnevnice (8–12 h)*: zadano **15,00 €**
     - *Naknada po km (privatno vozilo)*: zadano **0,50 €/km**
     - *Minimalna udaljenost*: zadano **30 km**
     - *Umanjenje za 1 obrok (%)*: zadano **30%** / *Umanjenje za 2 obroka (%)*: zadano **60%**.
   - Klikom na **`Vrati zakonske stope RH`** vraćate iznose na propisane neoporezive vrijednosti, a klikom na **`Spremi postavke`** pohranjujete izmjene za svoju tvrtku.

---

### 4.3. Rad s putnim nalozima (Tuzemni i Inozemni)

#### Tuzemni putni nalozi (`Putni nalozi`)

1. **Kreiranje novog naloga:**
   - U modulu **`Putni nalozi`** kliknite na gumb **`+ Novi putni nalog`** (ili odaberite relaciju na interaktivnoj karti Hrvatske i kliknite *Kreiraj nalog s ovom rutom*).
   - Modalni prozor vodi vas kroz **3 pregledna koraka**:
     - **Korak 1 — Nalog i ruta:** Odaberite *Datum izdavanja*, *Status naloga*, *Zaposlenika*, unesite detaljnu *Svrhu službenog putovanja* te *Mjesto polaska*, *Mjesto odredišta* i *Udaljenost u jednom smjeru (km)*. Možete odabrati brzu međugradsku relaciju s automatskim izračunom kilometara i cestarine.
     - **Korak 2 — Vrijeme, prijevoz i obroci:** Unesite *Datum i vrijeme polaska* te *Datum i vrijeme povratka*. Odaberite *Vrsta prijevoza* (`Privatno vozilo (0,50 €/km)`, `Službeno vozilo` ili `Javni prijevoz`) i pripadajuće vozilo te *Početno* i *Završno stanje brojila (km)*. Po potrebi unesite broj dana s *1 osiguranim obrokom (-30%)* ili *2 osigurana obroka (-60%)* te *Isplaćenu akontaciju (€)*.
     - **Korak 3 — Ostali troškovi i izvješće:** Dodajte priložene račune po kategorijama (*Cestarina*, *Parking*, *Smještaj*, *Javni prijevoz*, *Gorivo*, *Ostalo*), unesite *Izvješće s puta* i *Osobu koja odobrava nalog*, pa kliknite **`Spremi putni nalog`**.
2. **Provjera zakonske usklađenosti uživo:**
   - Sustav tijekom unosa automatski provjerava i prikazuje upozorenja ako je:
     - udaljenost manja od 30 km (tada se preporučuje *Loko vožnja*),
     - datum izdavanja naloga kasniji od datuma polaska na put,
     - svrha putovanja prekratka ili preopćenita,
     - unesen račun za gorivo uz istovremeni obračun naknade od 0,50 €/km za privatno vozilo,
     - zaboravljeno početno/završno stanje brojila za vozilo.
3. **Životni ciklus i statusi putnog naloga:**
   - Svaki putni nalog prolazi kroz 4 statusa:
     1. **`NACRT` (Nacrt)** — nalog je u pripremi.
     2. **`ODOBREN` (Odobren)** — nalog je odobren prije polaska na službeni put.
     3. **`OBRACUNAT` (Obračunat)** — po povratku s puta uneseno je završno stanje brojila, priloženi računi i izvješće s puta.
     4. **`ISPLACEN` (Isplaćen)** — obračunati iznos isplaćen je radniku (nalog ulazi u konačni obračun i JOPPD izvješće).
   - Korisnici s ovlašću **`Odobravanje i isplata naloga`** (`canApproveTravelOrders`) mogu mijenjati status izravno u tablici naloga ili unutar obrasca naloga.
4. **Službeni A4 ispis / PDF obrazac:**
   - Klikom na ikonu pisača (**`Ispis / PDF`**) uz bilo koji putni nalog otvara se službeni dvostrani A4 obrazac:
     - **Stranica 1:** *Nalog za službeno putovanje* (podaci tvrtke, podaci radnika, relacija, svrha, odobrenje i pečat/potpis nalogodavca).
     - **Stranica 2:** *Obračun putnih troškova* (specifikacija dnevnica i umanjenja za obroke, obračun kilometraže s brojilom, tablica ostalih troškova, rekapitulacija za isplatu, izvješće s puta i tri potpisne linije: *Podnositelj računa*, *Pregledao likvidator*, *Odobrio nalogodavac*).
   - Kliknite **`Ispiši ili spremi kao PDF`** i u dijalogu preglednika odaberite pisač ili opciju **Save as PDF / Spremi kao PDF**.

#### Inozemni putni nalozi (`Inozemni nalozi`)

- U modulu **`Inozemni nalozi`** odaberite državu odredišta iz kataloga propisanih inozemnih dnevnica (EU, ostatak Europe, Svijet), unesite vrijeme polaska iz RH, vrijeme prijelaza granice pri odlasku i povratku te vrijeme povratka u sjedište.
- Sustav automatski razdvaja tuzemni i inozemni dio putovanja, računa inozemne dnevnice u odgovarajućoj valuti (EUR/USD), primjenjuje umanjenja za obroke (30% / 60%) i omogućuje izravan **ispis A4 obračuna inozemnog putnog naloga**.

---

### 4.4. Loco vožnje, Matični podaci, Analitika i JOPPD obrazac

- **Loko vožnja (`Loko vožnja`):**
  - Služi za evidenciju gradskih i lokalnih službenih vožnji privatnim vozilom na relacijama kraćim od 30 km.
  - Odaberite datum, zaposlenika, privatno vozilo, relaciju (*Polazište* -> *Odredište*), svrhu te unesite početno i završno stanje brojila (ili prijeđene kilometre). Sustav automatski množi kilometre sa stopom (`0,50 €/km`) i ažurira stanje brojila vozila.
  - Vožnje možete filtrirati po radniku, označiti kao **Isplaćeno** te ispisati mjesečni obračun klikom na **`Ispiši izvješće`**.
- **Matični podaci (`Tvrtka, radnici i vozila`):**
  - Uz postavke tvrtke, ovdje dodajete nove **Zaposlenike** (*Ime i prezime*, *OIB*, *Radno mjesto*, *Adresa prebivališta*) i **Vozila** (*Privatno* ili *Službeno*, *Marka i model*, *Registracijska oznaka*, *Vlasnik/korisnik*, *Trenutno stanje brojila*).
  - Zaposlenike i vozila koji više nisu aktivni možete jednim klikom deaktivirati bez gubitka povijesnih putnih naloga.
- **Analitika i izvoz (`Analitika i izvoz`):**
  - Prikazuje ključne pokazatelje (ukupno isplaćeno, prosjek po nalogu, strukturu troškova: dnevnice / kilometraža / cestarine i ostalo, mjesečne trendove te rang-ljestvicu po zaposlenicima i vozilima).
  - Klikom na **`Preuzmi Excel CSV`** preuzimate cjelovitu tablicu svih putnih naloga aktivne tvrtke prilagođenu za Microsoft Excel (UTF-8 s BOM-om).
- **JOPPD obrazac (`JOPPD obrazac`):**
  - Automatski prikuplja obračunate i/ili isplaćene putne naloge i loko vožnje za odabrani mjesec te ih grupira po poreznim oznakama neoporezivih primitaka (Prilog 4 JOPPD):
    - **Šifra 17** — Neoporezive dnevnice za službena putovanja i naknade prijevoznih troškova na službenom putu.
    - **Šifra 18** — Naknada za korištenje privatnog automobila u službene svrhe — loko vožnja (`0,50 €/km`).
    - **Šifra 19** — Ostali neoporezivi troškovi službenog putovanja (cestarina, parking, tunelarina, smještaj i dr.).
  - Klikom na **`Preuzmi JOPPD XML`** preuzimate XML datoteku po službenoj shemi Porezne uprave (`http://e-porezna.porezna-uprava.hr/sheme/zahtjevi/ObrazacJOPPD/v1-1`), a dostupni su i **`Preuzmi CSV`** te **`Prikaži XML`** za brzu kontrolu.

---

## 5. Sigurnosna kopija i vraćanje podataka (Backup & Restore)

Modul **`Sigurnosna kopija (Backup)`** u lijevom izborniku omogućuje jednostavnu izradu sigurnosne kopije i vraćanje podataka putem preglednika. Pristup imaju **Globalni Admin**, **Administrator tvrtke** te podkorisnici s uključenim pravom `canBackupRestore`.

### 5.1. Izrada sigurnosne kopije (Backup)

1. Otvorite modul **`Sigurnosna kopija (Backup)`**.
2. U lijevom stupcu **1. Izrada sigurnosne kopije (Backup)** prikazan je trenutni broj zaposlenika, vozila, putnih naloga i loko vožnji aktivne tvrtke.
3. Kliknite na plavi gumb **`Preuzmi sigurnosnu kopiju tvrtke (...)`**:
   - Na vaše računalo preuzima se strukturirana `.json` datoteka (npr. `putni-nalozi-backup-adriatik-tehnologije-d-o-o-2026-11-14.json`) koja sadrži sve podatke te tvrtke (postavke, zaposlenike, vozila, putne naloge s troškovima, loko vožnje i korisnike tvrtke).
4. **Cjelovita sigurnosna kopija sustava (samo za Globalnog Admina):**
   - Ako ste prijavljeni kao **Globalni Admin**, ispod se nalazi i ljubičasta sekcija s gumbom **`Preuzmi cjeloviti sustavski backup (Sve tvrtke i korisnici)`**.
   - Ova datoteka (`putni-nalozi-sustav-backup-YYYY-MM-DD.json`) sadrži kompletne podatke **svih registriranih tvrtki** i **svih korisničkih računa** u jednoj datoteci.

### 5.2. Vraćanje podataka iz sigurnosne kopije (Restore)

1. U desnom stupcu **2. Vraćanje podataka (Restore)** kliknite na polje **`Kliknite za odabir .json datoteke sigurnosne kopije`** i odaberite prethodno spremljenu `.json` datoteku.
2. Sustav će odmah provjeriti ispravnost datoteke i prikazati karticu **Pregled učitane sigurnosne kopije** (datum izvoza, autor, izvorna tvrtka, OIB te broj zaposlenika, vozila, putnih naloga i loko vožnji u datoteci).
3. Odaberite jedan od dva načina vraćanja podataka:

| Način vraćanja | Opis i kada ga koristiti |
| :--- | :--- |
| **Spoji s postojećim podacima (Merge) — *Preporučeno*** | **Zadržava sve postojeće zapise** u aktivnoj tvrtki i nadodaje nove zaposlenike, vozila, putne naloge i loko vožnje iz učitane datoteke (postojeći zaposlenici s istim OIB-om, vozila s istom registracijom i putni nalozi s istim brojem naloga inteligentno se povezuju/ažuriraju bez dupliciranja). Koristite kada želite dopuniti evidenciju ili uvesti podatke bez brisanja trenutnog stanja. |
| **Zamijeni sve podatke tvrtke (Replace)** | **Briše trenutne zaposlenike, vozila, putne naloge i loko vožnje aktivne tvrtke** te ih u potpunosti zamjenjuje stanjem iz učitane sigurnosne kopije. Prije izvršavanja sustav traži dodatnu potvrdu. *Napomena:* Zamjena se odnosi isključivo na trenutno aktivnu tvrtku; podaci svih ostalih tvrtki u sustavu ostaju potpuno netaknuti. |

4. Kliknite zeleni gumb **`Izvrši vraćanje podataka u tvrtku "..."`**. Po završetku prikazat će se točan sažetak vraćenih zapisa, a podaci u aplikaciji automatski će se osvježiti.

### 5.3. Preporuke za redovito sigurnosno kopiranje

- **JSON eksport iz aplikacije:** Preporučuje se jednom tjedno ili nakon svakog mjesečnog obračuna i predaje JOPPD obrasca preuzeti `.json` sigurnosnu kopiju kroz modul *Sigurnosna kopija (Backup)*.
- **Kopija SQLite datoteke baze podataka:** Svi podaci sustava fizički su pohranjeni u datoteci unutar mape projekta:
  ```text
  ./data/putni_nalozi.db
  ```
  Za dodatnu sigurnost na razini operacijskog sustava možete povremeno kopirati cijelu mapu `./data/` na vanjski disk ili u oblak (OneDrive / Google Drive).

---

## 6. Tehnička arhitektura i API pregled

### 6.1. Tehnološki stog

- **Frontend i Backend okvir:** Next.js 16 (App Router, React 19, TypeScript)
- **Stiliziranje i ikone:** Tailwind CSS 4 + `lucide-react`
- **Baza podataka:** Ugrađeni Node.js SQLite modul (`node:sqlite` — `DatabaseSync`) u WAL (*Write-Ahead Logging*) načinu rada, pohranjen u `data/putni_nalozi.db`
- **Autentifikacija i sigurnost:** Lozinke se kriptografski hashiraju pomoću `node:crypto` (`scryptSync` sa slučajnim *saltom*), a sesija se održava putem potpisanog (`HMAC-SHA256`) `HttpOnly` kolačića `pn_session`.

### 6.2. Pregled tablica u SQLite bazi podataka (`data/putni_nalozi.db`)

| Tablica | Ključni stupci i namjena |
| :--- | :--- |
| **`companies`** | Registar svih tvrtki u sustavu (`id`, `name`, `oib`, `address`, `city`, `iban`, `director_name`, `order_prefix`, stope dnevnica i kilometraže, `active`, `created_at`). |
| **`users`** | Korisnički računi sustava (`id`, `email`, `password_hash`, `full_name`, `role` (`global_admin` \| `company_admin` \| `user`), `company_id`, `permissions` (JSON string sa 7 boolean zastavica), `active`, `created_at`). |
| **`company_settings`** | Postavke i neoporezive stope po tvrtki (`company_id`, `name`, `oib`, `iban`, `per_diem_full`, `per_diem_half`, `mileage_rate`, `min_distance_km`, `meal_deduction_one_pct`, `meal_deduction_two_pct`). |
| **`employees`** | Zaposlenici tvrtke (`id`, `company_id`, `full_name`, `oib`, `job_title`, `address`, `active`). |
| **`vehicles`** | Službena i privatna vozila tvrtke (`id`, `company_id`, `ownership_type`, `make_model`, `license_plate`, `employee_id`, `current_odometer`, `active`). |
| **`travel_orders`** | Putni nalozi izolirani po `company_id` (`id`, `company_id`, `order_number`, `year`, `seq_number`, `status`, `issue_date`, `employee_id`, `purpose`, `origin`, `destination`, `distance_km`, `departure_at`, `return_at`, `transport_type`, `vehicle_id`, `odometer_start`, `odometer_end`, `total_km`, `one_meal_days`, `two_meals_days`, `advance_payment_eur`, izračunati iznosi u EUR, `approved_by`). |
| **`travel_expenses`** | Priloženi računi i ostali troškovi vezani uz putni nalog (`id`, `travel_order_id`, `category`, `description`, `receipt_number`, `expense_date`, `amount_eur`). |
| **`loco_trips`** | Evidencija loko vožnji izolirana po `company_id` (`id`, `company_id`, `trip_date`, `employee_id`, `vehicle_id`, `origin`, `destination`, `purpose`, `odometer_start`, `odometer_end`, `distance_km`, `rate_eur`, `amount_eur`, `status`). |

### 6.3. Pregled REST API ruta (`src/app/api/**`)

Sve API rute automatski provjeravaju sesiju prijavljenog korisnika, izoliraju podatke prema aktivnom `companyId` kontekstu i provjeravaju odgovarajuću ovlast u `UserPermissions`:

| API ruta | HTTP metode | Potrebna uloga / ovlast | Opis funkcionalnosti |
| :--- | :--- | :--- | :--- |
| `/api/auth/login` | `POST` | Javno | Prijava korisnika putem `email` i `password`, postavlja `pn_session` kolačić i vraća `AuthSession`. |
| `/api/auth/logout` | `POST` | Prijavljeni korisnik | Odjava korisnika i brisanje sesijskog kolačića. |
| `/api/auth/me` | `GET`, `POST`, `PATCH` | Prijavljeni korisnik | Dohvat trenutne sesije (`GET`), prebacivanje aktivne tvrtke (`activeCompanyId` za `global_admin`) ili promjena vlastitog imena/lozinke (`POST`/`PATCH`). |
| `/api/companies` | `GET`, `POST` | `global_admin` (kreiranje) | Dohvat popisa tvrtki (`GET`) i kreiranje nove tvrtke u sustavu (`POST`). |
| `/api/companies/[id]` | `GET`, `PATCH`, `PUT`, `DELETE` | `global_admin` ili `company_admin` | Uređivanje podataka tvrtke, aktivacija/deaktivacija ili brisanje tvrtke (`DELETE` samo `global_admin`). |
| `/api/users` | `GET`, `POST` | `global_admin` ili `company_admin` | Dohvat korisnika (svih ili unutar aktivne tvrtke) i kreiranje novog korisnika/podkorisnika s granularnim ovlastima. |
| `/api/users/[id]` | `PATCH`, `PUT`, `DELETE` | `global_admin` ili `company_admin` | Ažuriranje ovlasti (`permissions`), uloge, tvrtke, resetiranje lozinke, aktivacija/deaktivacija ili brisanje korisnika. |
| `/api/settings` | `GET`, `PUT` | `canManageMasterData` (za `PUT`) | Dohvat i spremanje postavki te poreznih stopa aktivne tvrtke. |
| `/api/employees` i `/api/employees/[id]` | `GET`, `POST`, `PUT`, `DELETE` | `canManageMasterData` (za izmjene) | Upravljanje zaposlenicima aktivne tvrtke. |
| `/api/vehicles` i `/api/vehicles/[id]` | `GET`, `POST`, `PUT`, `DELETE` | `canManageMasterData` (za izmjene) | Upravljanje vozilima aktivne tvrtke. |
| `/api/travel-orders` i `/api/travel-orders/[id]` | `GET`, `POST`, `PUT`, `PATCH`, `DELETE` | `canManageTravelOrders` / `canApproveTravelOrders` | Dohvat, kreiranje, uređivanje, odobravanje statusa (`PATCH`) i brisanje putnih naloga aktivne tvrtke. |
| `/api/loco-trips` i `/api/loco-trips/[id]` | `GET`, `POST`, `PATCH`, `DELETE` | `canManageLoco` (za izmjene) | Evidencija, promjena statusa isplate i brisanje loko vožnji aktivne tvrtke. |
| `/api/backup` | `GET` | `canBackupRestore` | Izvoz strukturirane JSON sigurnosne kopije (`?scope=company` za aktivnu tvrtku ili `?scope=all` za cijeli sustav — `global_admin`). |
| `/api/restore` | `POST` | `canBackupRestore` | Vraćanje podataka iz JSON sigurnosne kopije uz odabrani način rada (`mode: "merge" \| "replace"`). |

---

## 7. Sigurnosna arhitektura i zaštita sustava (OWASP Top 10)

Sustav **Putni Nalozi HR** ugrađuje višeslojne sigurnosne mehanizme koji štite podatke tvrtki i korisnika te su u potpunosti prilagođeni i za rad na lokalnom poslužitelju bez HTTPS-a (`http://localhost:3000`):

1. **Kriptografska pohrana lozinki i zaštita sesije (`pn_session`):**
   - Lozinke se hashiraju pomoću `node:crypto` (`scryptSync` sa 16-bajtnim slučajnim *saltom*) i nikada se ne vraćaju kroz API odgovore.
   - Sesijski kolačić `pn_session` potpisan je algoritmom **HMAC-SHA256** uz unikatni 256-bitni kriptografski ključ (`AUTH_SECRET` ili automatski generirani `data/.session_secret`).
   - Provjera potpisa koristi `crypto.timingSafeEqual` (zaštita od *timing* napada), odbija tokene s ubačenim ili izmijenjenim svojstvima te postavlja `HttpOnly` i `SameSite=Lax` zastavice bez bezuvjetnog `Secure` atributa kako bi prijava radila i preko lokalnog HTTP-a.
2. **Brute-Force zaštita prijave (Rate Limiting):**
   - Ruta `POST /api/auth/login` ograničava broj neuspješnih pokušaja prijave na maksimalno **10 pokušaja unutar 15 minuta** po IP adresi i e-mail adresi. Nakon prekoračenja vraća se status `429 Too Many Requests` s `Retry-After` zaglavljem, dok uspješna prijava resetira brojač.
3. **Višetvrtkovna izolacija (Multi-Tenancy) i zaštita od IDOR napada:**
   - Svaki API poziv na poslužitelju prisilno filtrira i provjerava zapise prema `session.activeCompanyId`.
   - Korisnici s ulogom `company_admin` ili `user` ne mogu prebaciti aktivnu tvrtku putem `?companyId=` parametra, `x-company-id` zaglavlja ili `/api/auth/me`, a svaki pokušaj pristupa ili izmjene tuđeg zapisa po ID-u vraća `404 Not Found` ili `403 Forbidden`.
4. **Striktna RBAC kontrola na poslužitelju i trenutni opoziv ovlasti:**
   - Svih 7 pojedinačnih ovlasti (`UserPermissions`) te administrativne uloge (`global_admin`, `company_admin`) provjeravaju se izravno iz baze podataka pri svakom HTTP zahtjevu.
   - Oduzimanje ovlasti ili deaktivacija korisnika (`active = 0`) stupa na snagu **trenutačno** na postojećoj sesiji bez čekanja na odjavu ili istek kolačića.
   - Onemogućena je svaka eskalacija privilegija putem `/api/users`, `/api/auth/me` ili učitavanjem manipulirane sigurnosne kopije u `/api/restore`.
5. **Zaštita od SQL, XML (JOPPD) i CSV Formula Injection napada:**
   - Svi upiti prema SQLite bazi koriste isključivo parametrizirane `?` upite (`Prepared Statements`).
   - Generiranje JOPPD XML obrasca koristi `escapeXml` za sve specijalne znakove (`<`, `>`, `&`, `"`, `'`).
   - Izvoz u CSV (`JOPPD CSV` i `Analitika Excel CSV`) koristi `escapeCsvCell` koji automatski neutralizira potencijalno opasne Excel formule koje počinju znakovima `=`, `+`, `-` ili `@`.
6. **Sigurnosna HTTP zaglavlja (`next.config.ts`):**
   - Na svim odgovorima poslužitelja postavljena su zaglavlja `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin` i `Permissions-Policy`.

> 🛡️ **Cjelovito izvješće o testiranju i sigurnosnoj reviziji:**
> Detaljan pregled svih provedenih funkcionalnih, poreznih, RBAC i sigurnosnih (OWASP Top 10) testova potražite u dokumentu **[IZVJESCE_O_TESTIRANJU.md](./IZVJESCE_O_TESTIRANJU.md)**.

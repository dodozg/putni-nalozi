# Putni nalozi — Web aplikacija po hrvatskim propisima

Moderna web aplikacija za vođenje i obračun **putnih naloga** i **loko vožnje** u Republici Hrvatskoj, usklađena s važećim **Pravilnikom o porezu na dohodak**.

## Ključne funkcionalnosti

- **Tuzemni putni nalozi i automatski obračun dnevnica:**
  - Provjera minimalne udaljenosti od **30 km** za pravo na neoporezivu dnevnicu
  - Automatski izračun sati puta: `> 12 h` = **30,00 €**, `8–12 h` = **15,00 €**, `< 8 h` = **0,00 €**
  - Višednevna putovanja (po svakih započetih 24 sata)
  - Umanjenje dnevnice za osigurane besplatne obroke (**-30%** za 1 obrok, **-60%** za 2 obroka)
- **Korištenje privatnog automobila i Loko vožnja:**
  - Neoporeziva naknada **0,50 €/km**
  - Obavezno praćenje početnog i završnog stanja kilometarskog brojila
  - Zaseban modul za **Loko vožnju** (`< 30 km`) s ispisom mjesečnog izvješća
- **Provjera zakonske usklađenosti uživo:**
  - Upozorenje ako je datum izdavanja naloga nakon datuma polaska
  - Upozorenje za općenitu svrhu puta
  - Zabrana/upozorenje za unos goriva uz naknadu od 0,50 €/km za privatno vozilo
- **Službeni ispis / PDF obrazac (A4):**
  - Stranica 1: Nalog za službeno putovanje s podacima tvrtke, radnika i potpisom odobravatelja
  - Stranica 2: Obračun putnih troškova, specifikacija dnevnica, kilometraže, priloženih računa, akontacije, razlike za isplatu/povrat, izvješća s puta i 3 potpisne crte
- **Evidencija tvrtke, zaposlenika i vozila:**
  - Postavke tvrtke (OIB, sjedište, IBAN, odgovorna osoba, zakonske stope)
  - Upravljanje zaposlenicima i vozilima (službena i privatna)

## Tehnologije

- **Next.js 16** (App Router, TypeScript)
- **Tailwind CSS**
- **SQLite** (ugrađeni `node:sqlite` — bez potrebe za vanjskim bazama podataka)

## Pokretanje lokalno

```bash
npm install
npm run dev
```

Aplikacija će biti dostupna na `http://localhost:3000`. Prilikom prvog pokretanja automatski se kreira lokalna SQLite baza (`data/putni_nalozi.db`) s početnim demo podacima.

## Testiranje porezne logike

```bash
node --test src/lib/croatian-rules.test.ts
```

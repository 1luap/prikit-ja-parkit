# Prikit ja parkit

Partiotapahtuman rastitehtävä: puhelimesta tulee kiikarit, joilla katsellaan 120 asteen satamalahtea. Lahdella on ankkurissa laivoja, joiden mastojen väliin on nostettu viestilippuja (International Code of Signals).

## Käyttö

- Avaa sivu puhelimella ja paina **Aloita**. iPhone kysyy luvan liiketunnistimen käyttöön.
- Pidä puhelinta pystyssä edessäsi ja käänny. Lähennä nipistämällä tai painikkeilla.
- Jos tunnistinta ei ole (esim. tietokone), näkymää siirretään vetämällä ja lähennetään hiiren rullalla.

## Rakenne

- `index.html`, `app.js`: maisema piirretään canvasille, ei riippuvuuksia.
- `img/laiva-*.png`: laivat valmiiksi piirrettyine lippuineen. Lippujen sisältö on vain kuvissa, ei koodissa.

Lippukuvat: [signal-flag-images](https://www.npmjs.com/package/signal-flag-images) (public domain).

## Julkaisu

GitHub Pages: Settings → Pages → Deploy from branch → `main` / root.

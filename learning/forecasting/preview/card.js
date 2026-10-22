const byId = id => document.getElementById(id);
const format = value => value.toLocaleString('fi-FI', {minimumFractionDigits:1,maximumFractionDigits:1});
let data;
function selectModel(model) {
  const probability = data.probabilities[model];
  for (const button of document.querySelectorAll('[data-model]')) {
    const active = button.dataset.model === model;
    button.setAttribute('aria-selected', String(active));
    button.tabIndex = active ? 0 : -1;
  }
  byId('forecast-panel').setAttribute('aria-labelledby', model === 'margin' ? 'tab-margin' : 'tab-home');
  byId('home-probability').innerHTML = `${Math.round(100 * probability)}<span>%</span>`;
  byId('away-probability').innerHTML = `${Math.round(100 * (1-probability))}<span>%</span>`;
  byId('home-bar').style.width = `${probability * 100}%`;
  const favorite = probability > 0.5 ? data.teams[0].name : data.teams[1].name;
  byId('verdict').textContent = probability === 0.5 ? 'Malli arvioi ottelun tasavahvaksi.' : `${favorite} on mallin niukka suosikki.`;
  byId('model-explanation').textContent = model === 'margin'
    ? 'Tämä versio käyttää aiempien otteluiden piste-eroja. Kotipaikka ei muuta arviota.'
    : 'Tämä versio lisää aiemmasta miesten kaudesta sovitetun kotipaikkakorjauksen. Se ei tarkoita, että kotietu olisi tässä ottelussa varmistettu.';
}
fetch('card-data.json').then(response => {if (!response.ok) throw new Error('Aineisto puuttuu');return response.json();}).then(payload => {
  data = payload;
  byId('kickoff').textContent = data.kickoff;
  byId('match-title').textContent = `${data.teams[0].name} – ${data.teams[1].name}: mallin arvio`;
  for (const [index, side] of ['home', 'away'].entries()) {
    byId(`${side}-name`).textContent = data.teams[index].name;
    byId(`${side}-logo`).src = `assets/${data.teams[index].logo}.png`;
    const row = document.createElement('div');row.className = 'margin-row';
    const image = document.createElement('img');image.src = `assets/${data.teams[index].logo}.png`;image.alt = '';
    const name = document.createElement('span');name.textContent = data.teams[index].name;
    const sample = document.createElement('small');sample.textContent = `${data.teams[index].games} ottelua`;name.append(sample);
    const value = document.createElement('strong');value.className = index === 0 ? 'orange' : 'blue';
    value.textContent = data.teams[index].margin_average === null ? '—' : `${data.teams[index].margin_average > 0 ? '+' : ''}${format(data.teams[index].margin_average)}`;
    row.append(image,name,value);byId('margin-values').append(row);
    const evidenceHeading = document.createElement('strong');evidenceHeading.textContent = data.teams[index].name;byId('evidence').append(evidenceHeading);
    for (const game of data.teams[index].evidence) {
      const link = document.createElement('a');link.href = `https://tulospalvelu.basket.fi/match/${game.match_id}/statistics`;link.target = '_blank';link.rel = 'noopener noreferrer';
      link.textContent = `${new Date(game.date).toLocaleDateString('fi-FI',{timeZone:'Europe/Helsinki'})} · ${game.points_for}–${game.points_against} · lähdeottelu ↗`;byId('evidence').append(link);
    }
  }
  const shift = 100 * (data.probabilities.margin_home - data.probabilities.margin);
  byId('correction-text').textContent = `Malliversioiden ero: kotijoukkueen arvio ${shift >= 0 ? '+' : ''}${format(shift)} prosenttiyksikköä. Kotipaikkaversion arvio sisältää myös hieman eri sovitetun piste-eropainon.`;
  byId('sample-note').textContent = `Alkukausi: kummaltakin vain ${data.teams[0].games === data.teams[1].games ? data.teams[0].games : `${data.teams[0].games} / ${data.teams[1].games}`} ottelua. Näitä prosentteja ei ole vielä varmennettu uusilla otteluilla.`;
  byId('calculation').textContent = `Pienessä otoksessa piste-eroa tasataan kohti nollaa: kokonaispiste-ero jaetaan pelimäärällä + ${data.prior_games}. Mallin käyttämät tasatut luvut: ${format(data.teams[0].adjusted_margin)} ja ${format(data.teams[1].adjusted_margin)}. Näiden ero muunnetaan voittoprosentiksi vanhemmasta kaudesta sovitetulla kaavalla.`;
  byId('record-time').textContent = `Arvio tallennettu ${data.created_at}`;
  byId('source-time').textContent = `Aineisto päivitetty ${data.source_updated_at}`;
  byId('version').textContent = data.model_version;
  if (data.evaluation) {
    const entry = data.evaluation;
    byId('after-copy').textContent = 'Varmennettu tulos ja ensimmäinen ennen ottelua tallennettu seuranta-arvio. Myöhempi arvio ei korvaa alkuperäistä.';
    byId('after-result').textContent = `${entry.home_score}–${entry.away_score}`;
    const label = document.createElement('span');label.textContent = `Alkuperäinen kotivoittoarvio: piste-eromalli ${Math.round(entry.forecast.probabilities.margin*100)} % · kotipaikka ${Math.round(entry.forecast.probabilities.margin_home*100)} %`;byId('after-result').append(label);
  }
  selectModel('margin');
  for (const button of document.querySelectorAll('[data-model]')) {
    button.addEventListener('click', () => selectModel(button.dataset.model));
    button.addEventListener('keydown', event => {
      if (!['ArrowLeft','ArrowRight','Home','End'].includes(event.key)) return;
      event.preventDefault();
      const model = event.key === 'Home' ? 'margin' : event.key === 'End' ? 'margin_home' : button.dataset.model === 'margin' ? 'margin_home' : 'margin';
      selectModel(model);byId(model === 'margin' ? 'tab-margin' : 'tab-home').focus();
    });
  }
}).catch(error => {byId('kickoff').textContent = 'Ennusteen lataaminen epäonnistui. Päivitä paikallinen korttiaineisto.';console.error(error);});

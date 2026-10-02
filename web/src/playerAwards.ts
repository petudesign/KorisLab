export type PlayerAward = {
  playerId: string;
  season: "2024-25" | "2025-26";
  labelFi: string;
  labelEn: string;
  sourceUrl: string;
};

const awards2025 = "https://basket.fi/uutiset/samu-adler-ja-annika-aarrejoki-vuoden-pelaajat-palkintogaalassa-juhlistettiin-kauden-parhaita/";
const awards2024 = "https://basket.fi/uutiset/lassi-nikkarinen-ja-taru-tuukkanen-vuoden-pelaajat-palkintogaalassa-juhlistettiin-kauden-parhaita/";

export const playerAwards: PlayerAward[] = [
  { playerId: "dfe80f45-90bd-11f1-be7c-6be1da1f835c", season: "2025-26", labelFi: "Vuoden pelaaja", labelEn: "Player of the Year", sourceUrl: awards2025 },
  { playerId: "903b6ff9-90bc-11f1-8aff-7bff69c6eb8e", season: "2025-26", labelFi: "Vuoden ulkomaalaispelaaja", labelEn: "Foreign Player of the Year", sourceUrl: awards2025 },
  { playerId: "2c6d50fe-90bf-11f1-9c4e-515875ef95f7", season: "2025-26", labelFi: "Vuoden puolustuspelaaja", labelEn: "Defensive Player of the Year", sourceUrl: awards2025 },
  { playerId: "30fa0d78-90bd-11f1-927b-df0c7c693a34", season: "2025-26", labelFi: "Vuoden kuudes pelaaja", labelEn: "Sixth Player of the Year", sourceUrl: awards2025 },
  { playerId: "10cdb07f-90bd-11f1-9539-7b8c3a749dc5", season: "2025-26", labelFi: "Vuoden kehittynein", labelEn: "Most Improved Player", sourceUrl: awards2025 },
  { playerId: "2a5a38bc-90bf-11f1-9f47-515875ef95f7", season: "2025-26", labelFi: "Vuoden tulokas", labelEn: "Rookie of the Year", sourceUrl: awards2025 },
  { playerId: "903b6ff9-90bc-11f1-8aff-7bff69c6eb8e", season: "2025-26", labelFi: "Finaalin MVP", labelEn: "Finals MVP", sourceUrl: awards2025 },
  { playerId: "a0c836be-90be-11f1-911e-f55c6a1f11ab", season: "2025-26", labelFi: "Vapaaheittopalkinto", labelEn: "Free-throw Award", sourceUrl: awards2025 },
  { playerId: "91a241bb-90b8-11f1-8517-831680e207e8", season: "2024-25", labelFi: "Vuoden pelaaja", labelEn: "Player of the Year", sourceUrl: awards2024 },
  { playerId: "7a569082-90ba-11f1-a9c7-e3e1095353b3", season: "2024-25", labelFi: "Vuoden ulkomaalaispelaaja", labelEn: "Foreign Player of the Year", sourceUrl: awards2024 },
  { playerId: "9b566fe8-90bc-11f1-9632-d14817461866", season: "2024-25", labelFi: "Vuoden puolustuspelaaja", labelEn: "Defensive Player of the Year", sourceUrl: awards2024 },
  { playerId: "30fa0d78-90bd-11f1-927b-df0c7c693a34", season: "2024-25", labelFi: "Vuoden kuudes pelaaja", labelEn: "Sixth Player of the Year", sourceUrl: awards2024 },
  { playerId: "c55056c3-90bd-11f1-8e05-7b525a68ccc9", season: "2024-25", labelFi: "Vuoden kehittynein", labelEn: "Most Improved Player", sourceUrl: awards2024 },
  { playerId: "c570bb13-90bd-11f1-8a85-7b525a68ccc9", season: "2024-25", labelFi: "Vuoden tulokas", labelEn: "Rookie of the Year", sourceUrl: awards2024 },
  { playerId: "dd86bb5d-90ba-11f1-9171-770a70daccec", season: "2024-25", labelFi: "Finaalin MVP", labelEn: "Finals MVP", sourceUrl: awards2024 },
  { playerId: "37cccf0b-90bd-11f1-a10a-e11d336766e0", season: "2024-25", labelFi: "Vapaaheittopalkinto", labelEn: "Free-throw Award", sourceUrl: awards2024 },
];

export function getPlayerAwards(playerId: string) {
  return playerAwards.filter((award) => award.playerId === playerId);
}

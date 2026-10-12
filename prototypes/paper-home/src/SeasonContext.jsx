import { createContext, useContext } from 'react';
import datasets from '../source/seasons.json';
export const leagues={women:'Naisten Korisliiga',men:'Miesten Korisliiga'};
export const seasonIds=['2026-27','2025-26','2024-25'];
export const SeasonContext=createContext(null);
export const useSeason=()=>useContext(SeasonContext);
export const getSeason=(leagueId,seasonId)=>datasets[leagueId][seasonId];

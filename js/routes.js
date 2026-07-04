import List from './pages/List.js';
import AchievementList from './pages/AchievementList.js';
import VerifiedCsvList from './pages/VerifiedCsvList.js';
import Leaderboard from './pages/Leaderboard.js';
import Roulette from './pages/Roulette.js';

export default [
    { path: '/', component: VerifiedCsvList },
    { path: '/verified-list', component: VerifiedCsvList },
    { path: '/achievement-list', component: AchievementList },
    { path: '/experimental-verified-list', component: VerifiedCsvList },
    { path: '/leaderboard', component: Leaderboard },
    { path: '/roulette', component: Roulette },
];

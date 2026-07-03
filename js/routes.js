import List from './pages/List.js';
import AchievementList from './pages/AchievementList.js';
import Leaderboard from './pages/Leaderboard.js';
import Roulette from './pages/Roulette.js';

export default [
    { path: '/', component: AchievementList },
    { path: '/achievement-list', component: AchievementList },
    { path: '/verified-list', component: List },
    { path: '/leaderboard', component: Leaderboard },
    { path: '/roulette', component: Roulette },
];

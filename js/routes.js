import List from './pages/List.js';
import AchievementList from './pages/AchievementList.js';
import VerifiedCsvList from './pages/VerifiedCsvList.js';
import Leaderboard from './pages/Leaderboard.js';
import Roulette from './pages/Roulette.js';
import StatsViewer from './pages/StatsViewer.js';
import Home from './pages/Home.js';

export default [
    { path: '/', component: Home },
    { path: '/verified-list', component: VerifiedCsvList },
    { path: '/verified-list/:level', component: VerifiedCsvList },
    { path: '/achievement-list', component: AchievementList },
    { path: '/achievement-list/:level', component: AchievementList },
    { path: '/experimental-verified-list', component: VerifiedCsvList },
    { path: '/experimental-verified-list/:level', component: VerifiedCsvList },
    { path: '/leaderboard', component: Leaderboard },
    { path: '/stats-viewer', component: StatsViewer },
    { path: '/roulette', component: Roulette },
];

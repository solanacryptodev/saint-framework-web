import { useRequireAuth } from '~/libs/AuthProvider';
import PlayerLayout from '../components/PlayerLayout';

export default function PlayerRoute() {
    useRequireAuth("/");  // Redirect to home if not authenticated
    return <PlayerLayout />;
}

import GeneralGame from "~/components/games/GeneralGame";
import { useParams, useNavigate } from "@solidjs/router";

export default function GamePlayPage() {
    const params = useParams();
    const navigate = useNavigate();

    const handleBack = () => {
        // Navigate back to the game detail page
        navigate(`/play/game/${params.gameTitle}`);
    };

    return <GeneralGame onBack={handleBack} />;
}
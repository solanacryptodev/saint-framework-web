import { type JSX } from 'solid-js';
import './GameLayout.css';

export interface GameLayoutProps {
    agentPanel: JSX.Element;
    missionPanel: JSX.Element;
    intelPanel: JSX.Element;
}

export default function GameLayout(props: GameLayoutProps) {
    return (
        <div class="game-layout-wrapper">
            {/* Main Content */}
            <div class="game-layout">
                {/* Left Panel - Agent Profile */}
                <div class="panel-left">
                    {props.agentPanel}
                </div>

                {/* Center Panel - Mission */}
                <div class="panel-center">
                    {props.missionPanel}
                </div>

                {/* Right Panel - Intelligence */}
                <div class="panel-right">
                    {props.intelPanel}
                </div>
            </div>
        </div>
    );
}
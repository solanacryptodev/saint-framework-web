import { type JSX } from 'solid-js';
import './GameLayout.css';

export interface GameLayoutProps {
    characterPanel: JSX.Element;
    narrativePanel: JSX.Element;
    geoPanel: JSX.Element;
}

export default function GameLayout(props: GameLayoutProps) {
    return (
        <div class="game-layout-wrapper">
            {/* Main Content */}
            <div class="game-layout">
                {/* Left Panel - Character */}
                <div class="panel-left">
                    {props.characterPanel}
                </div>

                {/* Center Panel - Narrative */}
                <div class="panel-center">
                    {props.narrativePanel}
                </div>

                {/* Right Panel - Geo */}
                <div class="panel-right">
                    {props.geoPanel}
                </div>
            </div>
        </div>
    );
}

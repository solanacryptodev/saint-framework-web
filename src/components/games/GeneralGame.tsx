import GameLayout from './GameLayout';
import AgentProfile, { type AgentProfileProps } from './AgentProfile';
import MissionPanel, { type MissionPanelProps } from './MissionPanel';
import SiteIntelligence, { type SiteIntelligenceProps } from './SiteIntelligence';
import './GeneralGame.css';

export interface GeneralGameProps {
    agentData?: AgentProfileProps;
    missionData?: MissionPanelProps;
    intelData?: SiteIntelligenceProps;
    onBack?: () => void;
}

// Default data based on the reference image for spy/espionage theme
const defaultAgentData: AgentProfileProps = {
    name: 'AGENT CIPHER',
    clearance: 'BLACK DIAMOND',
    operativeStatus: {
        narrativeWeight: 0.78,
        emotionalState: -0.31,
        influenceReach: 0.62
    },
    psychologicalProfile: {
        traumaIndex: 0.42,
        resolve: 0.23,
        curiosity: 0.81
    },
    ideologicalAlignment: {
        classifiedIntel: 0.89,
        protocolOverride: 0.74,
        chainOfCommand: -0.65,
        selfPreservation: 0.52
    },
    susceptibilityVector: {
        moral: 0.71,
        method: 0.48,
        social: 0.39
    },
    actionPoints: {
        current: 82,
        max: 100
    }
};

const defaultMissionData: MissionPanelProps = {
    locationName: 'BLACK SITE OMEGA-7',
    phase: 'INFILTRATION',
    status: 'ACTIVE',
    paragraphs: [
        'The elevator descends past the official basement levels, through reinforced concrete and into bedrock. Your credentials—meticulously forged by the agency\'s best—got you past the lobby security, but down here, biometrics rule.',
        'The facility hums with the white noise of server farms cooling systems. Somewhere in this labyrinth of classified projects and buried secrets lies the proof you need: evidence of Operation Nightfall, the black program they swore never existed.',
        'A security terminal flickers at the corridor junction ahead. Its screen casts harsh light on the polished floor, and beyond it, a guard station manned by two armed operatives. They haven\'t seen you yet.'
    ],
    emphasisWords: ['biometrics rule', 'Operation Nightfall', 'armed operatives'],
    activeThreat: {
        name: 'Security Checkpoint Alpha',
        threatLevel: '[T:0.6 H:0.1 M:0.9]',
        exposureRisk: 0.38,
        intelSeed: '{suspicion: 0.7, danger: 0.8}'
    },
    operations: [
        {
            id: '1',
            sequence: 1,
            title: 'Neutralize guards with close-quarters takedown',
            method: 'METHOD',
            methodBonus: 0.3,
            risk: 'HIGH'
        },
        {
            id: '2',
            sequence: 2,
            title: 'Deploy electronic countermeasures to disable cameras',
            method: 'SOCIAL',
            methodBonus: 0.2,
            risk: 'MODERATE',
            requirement: 'TECH CHECK REQUIRED'
        },
        {
            id: '3',
            sequence: 3,
            title: 'Use forged credentials and bluff past checkpoint',
            method: 'MORAL',
            methodBonus: 0.15,
            risk: 'MODERATE'
        },
        {
            id: '4',
            sequence: 4,
            title: 'Find alternate route through ventilation system',
            method: 'METHOD',
            methodBonus: -0.1,
            risk: 'LOW'
        }
    ]
};

const defaultIntelData: SiteIntelligenceProps = {
    subLevel: 'SUB-LEVEL 4 // ARCHIVE WING',
    description: '"A classified archive housing decades of black operations data. Motion sensors active. Thermal imaging suspected."',
    environmentalAnalysis: {
        threatSignature: '[T:0.7 H:0.1 M:0.9]',
        tension: -0.54,
        coverRating: 0.15
    },
    locationMemory: [
        { id: '1', name: 'classified_ops', value: 0.82 },
        { id: '2', name: 'surveillance', value: 0.71 },
        { id: '3', name: 'lethal_force', value: 0.68 }
    ],
    proximityScan: [
        {
            id: '1',
            name: 'Security Detail',
            threatLevel: 0.85,
            awareness: 0.72,
            status: 'HOSTILE'
        }
    ],
    activeProtocols: [
        { id: '1', name: 'LOCKDOWN_READY', value: 0.79 },
        { id: '2', name: 'ASSET_PROTECTION', value: 0.61 },
        { id: '3', name: 'PATROL_FREQUENCY', value: 0.54 }
    ]
};

export default function GeneralGame(props: GeneralGameProps) {
    const agentData = props.agentData ?? defaultAgentData;
    const missionData = props.missionData ?? defaultMissionData;
    const intelData = props.intelData ?? defaultIntelData;

    return (
        <div class="general-game">
            {props.onBack && (
                <div class="general-game-back">
                    <button class="back-to-game" onClick={props.onBack}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                            <path d="M19 12H5M12 19l-7-7 7-7" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
                        </svg>
                        Back to Game Details
                    </button>
                </div>
            )}
            <GameLayout
                agentPanel={<AgentProfile {...agentData} />}
                missionPanel={<MissionPanel {...missionData} />}
                intelPanel={<SiteIntelligence {...intelData} />}
            />
        </div>
    );
}
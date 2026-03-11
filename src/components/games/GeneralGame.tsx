import GameLayout from './GameLayout';
import CharacterPanel, { type CharacterPanelProps } from './CharacterPanel';
import NarrativePanel, { type NarrativePanelProps } from './NarrativePanel';
import GeoPanel, { type GeoPanelProps } from './GeoPanel';
import './GeneralGame.css';

export interface GeneralGameProps {
    characterData?: CharacterPanelProps;
    narrativeData?: NarrativePanelProps;
    geoData?: GeoPanelProps;
    onBack?: () => void;
}

// Default data based on the reference image for "The Serpent and The Spy"
const defaultCharacterData: CharacterPanelProps = {
    name: 'Cipher // Null',
    className: 'SWARM_ARCHITECT',
    systemStatus: {
        integrity: 88,
        energy: 64
    },
    coreStats: {
        processing: 14,
        bandwidth: 22,
        encryption: 18,
        signal: 9
    },
    swarmNodes: 18,
    swarmActive: true
};

const defaultNarrativeData: NarrativePanelProps = {
    sectorNumber: 7,
    sectorTitle: 'THE ABYSSAL ARCHIVE',
    dataStream: '0X4B2C',
    paragraphs: [
        'The hyper-cooling fluid sloshes against your armored shins as you step into the vast, cavernous data center. Giant monolithic server towers rise from the dark water, their status lights blinking in a synchronized, hypnotic teal rhythm. The air is frigid, carrying the metallic taste of raw computation.',
        'Your HUD flickers as interference washes over your optic nerves. At the center of the chamber, suspended by thick, armored cables, hangs the Core Terminal. It is completely submerged in a containment field of dense coolant.',
        '"Detecting multiple sub-routines activating in the fluid," your Swarm intelligence whispers directly into your auditory cortex. The voice is a chorus of microscopic voices. "The archive is defending itself. Environmental hazards are increasing."',
        'You notice a thick bundle of severed optic fibers dangling near a catwalk to your right, sparking wildly and illuminating the dark water below. The liquid around the Core Terminal begins to churn.'
    ],
    emphasisWords: ['teal rhythm', 'Core Terminal', 'defending itself', 'churn'],
    actions: [
        {
            id: '1',
            sequence: 1,
            title: 'Wade into the fluid and interface with the Core Terminal directly.',
            requirement: 'PROCESSING CHECK'
        },
        {
            id: '2',
            sequence: 2,
            title: 'Deploy the Swarm to bridge the severed optic fibers.',
            requirement: 'SWARM_LINK REQUIRED'
        },
        {
            id: '3',
            sequence: 3,
            title: 'Scan the churning fluid for defensive countermeasures.',
            requirement: 'SIGNAL CHECK'
        },
        {
            id: '4',
            sequence: 4,
            title: 'Ignore the Core and proceed to the elevated catwalk.',
            requirement: 'EVASION'
        }
    ]
};

const defaultGeoData: GeoPanelProps = {
    geoData: {
        locationName: 'The Abyssal Archive',
        subLevel: 'Sub-Level // Deep Archive',
        description: 'A flooded containment sector meant to preserve pre-collapse military algorithms. Temperatures are lethal to baseline humans.'
    },
    proximityScan: {
        count: 1,
        alerts: [
            {
                id: '1',
                name: 'Core Terminal',
                status: 'DEFENSIVE',
                icon: 'warning'
            }
        ]
    },
    dataCache: {
        items: [
            { id: '1', icon: 'lightning', active: true },
            { id: '2', icon: 'shield', active: false },
            { id: '3', icon: 'document', active: false },
            { id: '4', icon: 'wifi', active: true }
        ]
    }
};

export default function GeneralGame(props: GeneralGameProps) {
    const characterData = props.characterData ?? defaultCharacterData;
    const narrativeData = props.narrativeData ?? defaultNarrativeData;
    const geoData = props.geoData ?? defaultGeoData;

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
                characterPanel={<CharacterPanel {...characterData} />}
                narrativePanel={<NarrativePanel {...narrativeData} />}
                geoPanel={<GeoPanel {...geoData} />}
            />
        </div>
    );
}

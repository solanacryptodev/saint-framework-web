import { BaseChainLink } from "../base-chain-link";
import { ChainAction, ChainContext } from "../types";

export class GenreAtmosphereLink extends BaseChainLink {
    readonly name = "genre_atmosphere";
    readonly priority = 45; // Runs right before ProseLink at 50

    constructor(private tone: string) {
        super();
    }

    canHandle(ctx: ChainContext): ChainAction {
        return ChainAction.HANDLED_CONTINUE;
    }

    async handle(ctx: ChainContext): Promise<void> {
        let atmosphereAdditions = "";

        switch (this.tone) {
            case "horror":
            case "southern_gothic":
                atmosphereAdditions = "The shadows feel oppressive, and a lingering sense of dread colors the environment.";
                break;
            case "thriller":
                atmosphereAdditions = "Tension hangs in the air, with an underlying sense of paranoia and high stakes.";
                break;
            case "science_fiction":
                atmosphereAdditions = "The atmosphere feels cold, calculated, and illuminated by artificial light or neon decay.";
                break;
            case "fantasy":
                atmosphereAdditions = "A mythical hum of ancient power and grand scale permeates the scene, feeling old and alive.";
                break;
            default:
                atmosphereAdditions = "";
        }

        if (atmosphereAdditions) {
            if (!ctx.metadata.sceneAtmosphere) {
                ctx.metadata.sceneAtmosphere = "";
            }
            ctx.metadata.sceneAtmosphere = `${ctx.metadata.sceneAtmosphere}\n[Genre Atmosphere: ${atmosphereAdditions}]`.trim();
        }

        console.log(`[GenreAtmosphereLink] Tone: ${this.tone} | Appended to atmosphere`);
    }
}

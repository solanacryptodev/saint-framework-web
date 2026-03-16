// src/routes/create.tsx
import { ForgeProvider } from "~/components/world-forge/ForgeContext";

export default function CreateLayout(props: any) {
    return <ForgeProvider>{props.children}</ForgeProvider>;
}
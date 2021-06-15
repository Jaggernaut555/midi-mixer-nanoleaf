import { NanoleafApi } from "./api"
import { Assignment, ButtonType } from "midi-mixer-plugin";

// I'm unsure of how nanoleaf works. I think it's one IP per group of light panels.
// If it is, this project will have to be adjusted to allow multiple ip+port+token combinations to create new groups.

// There's also "Effects" and "Rhythm" in the nanoleaf api, whatever those do.

const nm = new NanoleafApi();

const identifyConnection = async () => {
    console.log("identifying");
    nm.identify();
}

$MM.onSettingsButtonPress("identify", identifyConnection);

nm.init();
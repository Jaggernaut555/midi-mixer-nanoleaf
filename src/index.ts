import { Assignment, ButtonType } from "midi-mixer-plugin";
import { Nanoleaf } from 'nanoleaf-ts';

/*
I'm unsure of how nanoleaf works. I think it's one IP per group of light panels.
If it is, this project will have to be adjusted to allow multiple ip+port+token combinations to create new groups.

There's also "Effects" and "Rhythm" in the nanoleaf api, whatever those do.
*/

enum Selection {
    brightness = 0,
    hue,
    saturation
}

interface AssignmentData {
    assignment: Assignment
    activeSelection: Selection
    brightnessLevel: number
    hueLevel: number
    saturationLevel: number
    syncinterval?: NodeJS.Timeout
}

let nl: Nanoleaf;
let settings:Record<string,any>
let groupAssign: AssignmentData;

const updateSelection = (a: AssignmentData) => {
    if (!a.assignment.assigned && !a.assignment.running) {
        a.activeSelection = Selection.brightness;
        a.assignment.volume = a.brightnessLevel;
    } else if (a.assignment.assigned && !a.assignment.running) {
        a.activeSelection = Selection.hue;
        a.assignment.volume = a.hueLevel;
    } else if (!a.assignment.assigned && a.assignment.running) {
        a.activeSelection = Selection.saturation;
        a.assignment.volume = a.saturationLevel;
    }
}

const initNanoLeaf = async () => {
  let nanoleaf = new Nanoleaf({
    ipAddress: settings.ip,
    authToken: settings.apikey,
    apiVersion: "/api/v1/",
    port: settings.port
  });

  nl = nanoleaf;
 
  try {
    let isOn = await nanoleaf.state.isTurnedOn();
    $MM.setSettingsStatus("status", "Connected");

    groupAssign = {
        assignment: new Assignment("Nanoleaf-1",{
            name: "Nanoleaf-group"
        }),
        activeSelection: Selection.brightness,
        brightnessLevel: 0,
        hueLevel: 0,
        saturationLevel: 0
    }
    initGroup(groupAssign);
  } catch (err) {
    console.log(err);
    $MM.setSettingsStatus("status", "Could not connect");
  }
}

const initGroup = (a: AssignmentData) => {
    a.assignment.on("volumeChanged", async (level:number) => {
        a.assignment.volume = level;
        switch (a.activeSelection) {
            case Selection.brightness:
                a.brightnessLevel = level;
                await nl.state.setBrightness(level*100);
                break;
            case Selection.hue:
                a.hueLevel = level;
                await nl.state.setHue(level*360);
                break;
            case Selection.saturation:
                a.saturationLevel = level
                await nl.state.setSaturation(level*100)
                break;
            default:
                break;
        }
    })
    a.assignment.on("mutePressed", async () => {
        let val = await nl.state.toggleOnOffState();
        a.assignment.muted = val;
        update(a);
    });
    a.assignment.on("assignPressed", () => {
        if (!a.assignment.running) {
            a.assignment.assigned = !a.assignment.assigned
        }
        else if (!a.assignment.assigned && a.assignment.running) {
            a.assignment.assigned = true;
            a.assignment.running = false;
        }
        updateSelection(a);
    });
    a.assignment.on("runPressed", async () => {
        if (!a.assignment.assigned) {
            a.assignment.running = !a.assignment.running;
        }
        else if (a.assignment.assigned && !a.assignment.running) {
            a.assignment.assigned = false;
            a.assignment.running = true;
        }
        updateSelection(a);
    });

    if (a.syncinterval){
        clearInterval(a.syncinterval);
    }
    a.syncinterval = setInterval(async () => {
        await update(groupAssign);
    }, settings.syncinterval*1000)
}

const updateBrightness = async (a:AssignmentData) => {
    let val = await nl.state.getBrightness();
    a.brightnessLevel = val.value/100
}

const updateHue = async (a:AssignmentData) => {
    let val = await nl.state.getHue();
    a.hueLevel = val.value/360
}

const updateSaturation = async (a:AssignmentData) => {
    let val = await nl.state.getSaturation();
    a.saturationLevel = val.value/100
}

const updateVolume = (a:AssignmentData) => {
    switch (a.activeSelection) {
        case Selection.brightness:
            a.assignment.volume = a.brightnessLevel;
            break;
        case Selection.hue:
            a.assignment.volume = a.hueLevel;
            break;
        case Selection.saturation:
            a.assignment.volume = a.saturationLevel;
            break;
    }
}

const update = async (a:AssignmentData) => {
    let isOn = await nl.state.isTurnedOn();
    a.assignment.muted = isOn;
    await updateBrightness(a);
    await updateHue(a);
    await updateSaturation(a);
    updateVolume(a);
}

const init = async () => {
    settings = await $MM.getSettings()
    
    // plugin.json fallback doesn't seem to work?
    if (!settings.syncinterval) {
        settings.syncinterval = 15;
    }
    if (!settings.port) {
        settings.port = 16021;
    }

    await initNanoLeaf();
    await update(groupAssign);
}

const identifyConnection = async () => {
    try {
        console.log("identifying");
        await nl.panels.identify();
    } catch (error) {
        console.log(error);
        $MM.setSettingsStatus("status", "Error identifying panels");
    }
    update(groupAssign);
}

$MM.onSettingsButtonPress("identify", identifyConnection);

init();
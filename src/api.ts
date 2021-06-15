import { Assignment, ButtonType } from "midi-mixer-plugin";
import { Nanoleaf } from 'nanoleaf-ts';

interface Assignments {
    groups: Record<string, AssignmentData>
}

enum Selection {
    brightness = 0,
    hue,
    saturation
}

interface AssignmentData {
    nanoleaf: Nanoleaf
    assignment: Assignment
    activeSelection: Selection
    brightnessLevel: number
    hueLevel: number
    saturationLevel: number
    syncinterval?: NodeJS.Timeout
}

interface tokenRequest {
    auth_token: string
}

export class NanoleafApi {
    private assignments: Assignments = {
        groups: {}
    }

    private settings: Record<string,any> = $MM.getSettings();

    constructor() {
    }

    public async init() {
        this.settings = await $MM.getSettings()
    
        // TODO: plugin.json fallback doesn't seem to work?
        if (!this.settings.syncinterval) {
            this.settings.syncinterval = 15;
        }
        if (!this.settings.port) {
            this.settings.port = 16021;
        }
    
        // Temp way of setting two panels
        if (this.settings.ip) {
            await this.initNanoLeaf(1, this.settings.ip, this.settings.apikey, this.settings.port);
        }
        if (this.settings.ip2) {
            await this.initNanoLeaf(2, this.settings.ip2, this.settings.apikey2, this.settings.port2);
        }

        for(var id in this.assignments.groups) {
            await this.update(this.assignments.groups[id]);
        }
    }

    public async identify() {
        // TODO: identify each group. Perhaps set a midi-mixer button for this instead of the current settings page button
        try {
            await this.assignments.groups[this.settings.ip].nanoleaf.panels.identify();
        } catch (error) {
            console.log(error);
            $MM.setSettingsStatus("status", "Error identifying panels");
        }
    }

    private async initNanoLeaf(count:number, ip: string, apikey: string, port: string) {
        // TODO: Allow setting up more than one group
        let nanoleaf = new Nanoleaf({
          ipAddress: ip,
          authToken: apikey,
          apiVersion: "/api/v1/",
          port: port
        });
      
        try {
          let isOn = await nanoleaf.state.isTurnedOn();
          if (count == 1) {
              $MM.setSettingsStatus("status", "Connected");
          }
          else {
              $MM.setSettingsStatus("status2", "Connected");
          }
      
          this.assignments.groups[ip] = {
              nanoleaf: nanoleaf,
              assignment: new Assignment(`Nanoleaf-${count}`,{
                  name: `Nanoleaf Panel ${ip}`
              }),
              activeSelection: Selection.brightness,
              brightnessLevel: 0,
              hueLevel: 0,
              saturationLevel: 0
          }
          this.initGroup(this.assignments.groups[ip]);
        } catch (err) {
          console.log(err);
          if (count == 1) {
              $MM.setSettingsStatus("status", "Could not connect");
          }
          else {
            $MM.setSettingsStatus("status2", "Could not connect");
          }
        }
      }
    
    private updateSelection(a: AssignmentData) {
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

    private initGroup(a: AssignmentData) {
        a.assignment.on("volumeChanged", async (level:number) => {
            a.assignment.volume = level;
            switch (a.activeSelection) {
                case Selection.brightness:
                    a.brightnessLevel = level;
                    await a.nanoleaf.state.setBrightness(level*100);
                    break;
                case Selection.hue:
                    a.hueLevel = level;
                    await a.nanoleaf.state.setHue(level*360);
                    break;
                case Selection.saturation:
                    a.saturationLevel = level
                    await a.nanoleaf.state.setSaturation(level*100)
                    break;
                default:
                    break;
            }
        })
        a.assignment.on("mutePressed", async () => {
            let val = a.assignment.muted = !a.assignment.muted;
            await a.nanoleaf.state.modifyOnOffState(!val)
            this.update(a);
        });
        a.assignment.on("assignPressed", () => {
            if (!a.assignment.running) {
                a.assignment.assigned = !a.assignment.assigned
            }
            else if (!a.assignment.assigned && a.assignment.running) {
                a.assignment.assigned = true;
                a.assignment.running = false;
            }
            this.updateSelection(a);
        });
        a.assignment.on("runPressed", async () => {
            if (!a.assignment.assigned) {
                a.assignment.running = !a.assignment.running;
            }
            else if (a.assignment.assigned && !a.assignment.running) {
                a.assignment.assigned = false;
                a.assignment.running = true;
            }
            this.updateSelection(a);
        });
    
        if (a.syncinterval){
            clearInterval(a.syncinterval);
        }
        a.syncinterval = setInterval(async () => {
            await this.update(a);
        }, this.settings.syncinterval*1000)
    }
    private async updateBrightness(a:AssignmentData) {
        let val = await a.nanoleaf.state.getBrightness();
        a.brightnessLevel = val.value/100
    }
    
    private async updateHue(a:AssignmentData) {
        let val = await a.nanoleaf.state.getHue();
        a.hueLevel = val.value/360
    }
    
    private async updateSaturation(a:AssignmentData) {
        let val = await a.nanoleaf.state.getSaturation();
        a.saturationLevel = val.value/100
    }
    
    private updateVolume(a:AssignmentData) {
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

    private async update(a:AssignmentData) {
        let isOn = await a.nanoleaf.state.isTurnedOn();
        a.assignment.muted = isOn;
        await this.updateBrightness(a);
        await this.updateHue(a);
        await this.updateSaturation(a);
        this.updateVolume(a);
    }
}
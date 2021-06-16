import { NanoleafApi } from "./api"
import { Assignment, ButtonType } from "midi-mixer-plugin";
import fetch from "node-fetch";

// I'm unsure of how nanoleaf works. I think it's one IP per group of light panels.
// If it is, this project will have to be adjusted to allow multiple ip+port+token combinations to create new groups.

// There's also "Effects" and "Rhythm" in the nanoleaf api, whatever those do.

var Client = require('node-ssdp').Client
, client = new Client();

const nm = new NanoleafApi();

const request = async () => {
    console.log("Requesting auth_token");
    let settings = await $MM.getSettings();
    let ip:string = ""

    if (!settings.iprequest) {
        $MM.setSettingsStatus("tokenstatus", "No ip specified");
    }
    else {
        ip = settings.iprequest as string;
    }

    if (!ip.includes(":")) {
        ip = `${ip}:16021`
    }

    try {
        let response = await fetch(`http://${settings.iprequest}/api/v1/new`, {
            method: "POST"
        })
        if (response.ok) {
            let token = await response.json()
            $MM.setSettingsStatus("tokenstatus", token.auth_token)
        }
        else {
            $MM.setSettingsStatus("tokenstatus", response.statusText)
        }
    }
    catch (error) {
        console.log(error)
        $MM.setSettingsStatus("tokenstatus",`Could not connect to ${settings.iprequest}`)
    }
}

interface rInfo {
    address: string
    family: string
    port: number
    size: number
}

let discoveredIPs: string[]

client.on('response', (headers:any, statusCode:number, rinfo:rInfo) => {
    if (statusCode == 200) {
        console.log("got a response to an m-search.");
        if (!discoveredIPs.includes(rinfo.address)) {
            discoveredIPs.push(rinfo.address);
            $MM.setSettingsStatus("ipsearchstatus", discoveredIPs.toString());
        }
    }
});

const discovery = async () => {
    console.log("searching");
    // reset list
    discoveredIPs = [];
    client.search('nanoleaf:nl29');
    client.search('Nanoleaf_aurora:light');

}

$MM.onSettingsButtonPress("ipsearchbutton", discovery);
$MM.onSettingsButtonPress("tokenrequest", request);

nm.init();

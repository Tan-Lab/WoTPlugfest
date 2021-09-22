import * as WoT from "wot-typescript-definitions"

var request = require('request');
var fs = require('fs');

const Ajv = require('ajv');
var ajv = new Ajv();
var fetch = require('node-fetch');

export class WotDevice {
    public thing: WoT.ExposedThing;
    public WoT: WoT.WoT;
    public td: any;
	public SERVER_ADDR: any;
    constructor(WoT: WoT.WoT, dev, serverAddr, tdDirectory?: string) {
        //create WotDevice as a server
        this.WoT = WoT;
		this.SERVER_ADDR = serverAddr;
        this.WoT.produce(
			this.create_TD_FromFile(dev)
            //fill in the empty quotation marks
        ).then((exposedThing)=>{
			this.thing = exposedThing;
			this.td = exposedThing.getThingDescription();
			var properties = this.td['properties'];
			if(properties != undefined) {
				var pp = Object.keys(properties);
				for (var i = 0; i < pp.length; i++) {
					var readOnly = properties[pp[i]]['readOnly'];
					var writeOnly = properties[pp[i]]['writeOnly'];
					//var observable = properties[pp[i]]['observable'];
		    		this.add_properties(pp[i], readOnly,writeOnly);
				}
			}
			
			var actions = this.td['actions'];
			if(actions != undefined) {
				var action = Object.keys(actions);
				for (var i = 0; i < action.length; i++) {
		    		this.add_actions(action[i]);
				}
			}	
			var events = this.td['events'];
			if(events != undefined) {
				var event = Object.keys(events);
				for (var i = 0; i < event.length; i++) {
		    		this.add_events(event[i]);
				}
			}
			this.thing.expose();
			if (tdDirectory) { this.register(tdDirectory); }
			this.listen_to_myEvent(); //used to listen to specific events provided by a library. If you don't have events, simply remove it
        });
    }
    
    public register(directory: string) {
        console.log("Registering TD in directory: " + directory)
        request.post(directory, {json: this.thing.getThingDescription()}, (error, response, body) => {
            if (!error && response.statusCode < 300) {
                console.log("TD registered!");
            } else {
                console.debug(error);
                console.debug(response);
                console.warn("Failed to register TD. Will try again in 10 Seconds...");
                setTimeout(() => { this.register(directory) }, 10000);
                return;
            }
        });
    }


    private listen_to_myEvent() {
    	/*
		specialLibrary.getMyEvent()//change specialLibrary to your library
		.then((thisEvent) => {
			this.thing.emitEvent("myEvent",""); //change quotes to your own event data
    	});
    	*/
	}

    private add_properties(pp, readOnly, writeOnly) {
		this.thing.writeProperty(pp,"");
		if(!writeOnly) {
			this.thing.setPropertyReadHandler(pp,() => { 
				return new Promise((resolve, reject) => {
					var url = this.SERVER_ADDR
					+ this.td['id'] + '/properties/' + pp;
					fetch(url,{
					headers: {
					'Content-Type': 'application/json'}
					})
					.then(res =>{
						return res.json();
					})
					.then(data =>{
						resolve(data[pp]);
					}).catch((err) => {
						reject();
						console.log(err);
					});
						
				});           
			});
		}
		if(!readOnly) {
			this.thing.setPropertyWriteHandler(pp,(inputData) => { 
				return new Promise((resolve, reject) => {
					if (!ajv.validate(this.td.properties[pp],inputData)) {
						reject(new Error ("Invalid input"));
					}
					else {
						var url = this.SERVER_ADDR
						+ this.td['id'] + '/properties/' + pp;
						var bodyobj = {};
						bodyobj[pp] = inputData;
						fetch(url, { method: 'PUT', headers: {
							'Content-Type': 'application/json'
							
							},
						body: JSON.stringify(bodyobj),
						})
						.then(response => response.json())
						.then(data => {
						console.log('Success:', data);
							resolve();
						})
						.catch((error) => {
							console.error('Error:', error);
							reject();
						});
					}
						
				});           
			});
		}
    }

    private add_actions(action) {
		this.thing.setActionHandler(action,(inputData) => { 
			return new Promise((resolve, reject) => {
				if (!ajv.validate(this.td.actions[action].input,inputData)) {
					reject(new Error ("Invalid input"));
				}
				else {
					var url = this.SERVER_ADDR
					+ this.td['id'] + '/actions/' + action;
					fetch(url, { method: 'POST', headers: {
						'Content-Type': 'application/json'
						},
					})
					.then(response => response.json())
					.then(data => {
					console.log('Success:', data);
						resolve();
					})
					.catch((error) => {
						console.error('Error:', error);
						reject();
					});
				}
					
			});           
		});
    }
    private add_events(events) {
		// can/should be removed, no need to add events anywhere, just emit them
    }

	private create_TD_FromFile(dev){
		var defJSON = JSON.parse(fs.readFileSync('./src/TD/'+dev['deviceType'] + '.json', 'utf8'));
		var TDSchema = {
			"@context" : defJSON['@context'],
			"id" : "echonet:" + dev['deviceType'] + ":" +dev['id'],
			"title" : dev['deviceType'],
			"titles": defJSON['titles'],
			"description": defJSON['description'],
			"descriptions": defJSON['descriptions'],
			"properties": {
				
			}
		};
		var realProperties = dev['properties'];
		if (realProperties != undefined) {
			var realPP = Object.keys(realProperties);
			for (var i = 0; i < realPP.length; i++) {
				var schema = defJSON['properties'][realPP[i]]
				if( schema != undefined) {
					var jsonObj = new Object();
					jsonObj[realPP[i]] = schema;
					TDSchema['properties'][realPP[i]] = schema;	
				}
				
			}
		}	
		if(defJSON['actions'] != undefined) {
			TDSchema['actions'] = defJSON['actions'];
		}
		if(defJSON['events'] != undefined) {
			TDSchema['events'] = defJSON['events'];
		}
		return TDSchema;
	}
}

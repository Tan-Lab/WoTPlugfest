//Where your concrete implementation is included
WotDevice = require("./dist/baseProxy.js").WotDevice
//WotDevice = require("./dist/base.js").WotDevice

/*
This project supports the registration of the generated TD to a TD directory
Fill in the directory URI where the HTTP POST request to send the TD will be made
If you leave it empty, registration thread will never execute, otherwise it will try to register every 10 seconds 
*/
const TD_DIRECTORY = ""

const fetch = require('node-fetch');
Servient = require("@node-wot/core").Servient
//Importing the required bindings
HttpServer = require("@node-wot/binding-http").HttpServer
//CoapServer = require("@node-wot/binding-coap").CoapServer
//MqttBrokerServer = require("@node-wot/binding-mqtt").MqttBrokerServer

//Creating the instances of the binding servers
var httpServer = new HttpServer({ adress:'0.0.0.0', port:8081});
//var coapServer = new CoapServer({port: 5683});
//var mqttServer = new MqttBrokerServer("test.mosquitto.org"); //change it according to the broker address

const serverAddr= 'http://150.65.231.31:5000/elapi/v1/devices/'
//Building the servient object
var servient = new Servient();
//Adding different bindings to the server
servient.addServer(httpServer);
//servient.addServer(coapServer);
//servient.addServer(mqttServer);
mainProgram();


async function mainProgram(){
  var list = [];
  var devices = await devicesFromAPI();
  if(devices == undefined) {
    console.log('Can not get anything from EL webAPI');
  } else {
      for(var i =0; i < devices.length; i++) {
        var el = new Object();
        dev = devices[i];
        if(dev['deviceType'] == "bloodPressureMeter" || dev['deviceType'] == "bodyWeighingMachine" || dev['deviceType'] == "clinicalThermometer") {
          // ignore pcha device
        } else {
          el = dev;
          el['properties'] = await getProperties(dev);
          list.push(el);
        }
      }
      servient.start().then((WoT) => {
        for(var j =0; j < list.length; j ++){
           wotDevice = new WotDevice(WoT,list[j], serverAddr, TD_DIRECTORY);
        }
      });
  }
}
function devicesFromAPI (){
    return new Promise((resolve, reject) => {
      var url =serverAddr;
        fetch(url,{
        headers: {
          'Content-Type': 'application/json'}
        })
        .then(res =>{
          return res.json();
        })
        .then(data =>{
          devices = data['devices'];
          resolve(data['devices']);
        }).catch((err) => {
          reject();
          console.log(err);
        }); 
      });
  }
async function getProperties(device){
  var pp = await propertiesFromAPI(device['id']);
  return pp;
}
function propertiesFromAPI (id ){
  return new Promise((resolve, reject) => {
    var url =serverAddr + id + '/properties';
      fetch(url,{
      headers: {
      'Content-Type': 'application/json'}
      })
      .then(res =>{
        return res.json();
      })
      .then(data =>{
        resolve(data);
      }).catch((err) => {
        reject();
        console.log(err);
      }); 
    });
}


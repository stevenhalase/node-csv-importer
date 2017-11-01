var request = require('request');
var rp = require('request-promise');

var csv = require('csv-parser');
var fs = require('fs');

var Bottleneck = require("bottleneck");
var limiter = new Bottleneck(1, 100);

class TrelloImporter {

    constructor() {
        this.csvPath = 'csv/XXX.csv';
        this.ListId = '';
        this.BoardId = 'XXX';
        this.APIKey = 'XXX';
        this.Token = 'XXX';
    }

    ParseCSV() {
        fs.createReadStream(this.csvPath)
        .pipe(csv())
        .on('data', data => {
            let cardData = {
                cardName: data['Page/Tool Name'] + ' -- ' + data['Section'],
                cardDescription: data['Notes'],
                structure: data['Structure'] === 'Y' ? true : false,
                copy: data['Copy'] === 'Y' ? true : false,
                design: data['Design'] === 'Y' ? true : false,
                build: data['Build'] === 'Y' ? true : false,
                approved: data['Approved'] === 'Y' ? true : false,
                launchReady: data['Launch Ready'] === 'Y' ? true : false,
                ready: data['Ready'] === 'Y' ? true : false,
            }
            let auth = {
                APIKey: this.APIKey,
                Token: this.Token
            };
            limiter.schedule(this.GetBoardLists, auth, this.BoardId, cardData)
                .then(data => {
                    return limiter.schedule(this.CreateCard, data.auth, data.listId, data.cardData);
                })
                .then(data => {
                    return limiter.schedule(this.CreateCheckList, data);
                })
                .then(data => {
                    limiter.schedule(this.CreateCheckItems, data.auth, data.checkListId, data.cardData, 'Structure', data.cardData.structure);
                    return data;
                })
                .then(data => {
                    limiter.schedule(this.CreateCheckItems, data.auth, data.checkListId, data.cardData, 'Copy', data.cardData.copy);
                    return data;
                })
                .then(data => {
                    limiter.schedule(this.CreateCheckItems, data.auth, data.checkListId, data.cardData, 'Design', data.cardData.design);
                    return data;
                })
                .then(data => {
                    limiter.schedule(this.CreateCheckItems, data.auth, data.checkListId, data.cardData, 'Build', data.cardData.build);
                    return data;
                })
                .then(data => {
                    limiter.schedule(this.CreateCheckItems, data.auth, data.checkListId, data.cardData, 'Approved', data.cardData.approved);
                    return data;
                })
                .then(data => {
                    limiter.schedule(this.CreateCheckItems, data.auth, data.checkListId, data.cardData, 'Launch Ready', data.cardData.launchReady);
                    return data;
                })
                .then(data => {
                    limiter.schedule(this.CreateCheckItems, data.auth, data.checkListId, data.cardData, 'Ready', data.cardData.ready);
                    return data;
                })
                .then(data => {
                    console.log(data);
                })
                .catch(err => {
                    console.log(err);
                })
        });
    }

    GetBoardLists(auth, boardId, cardData) {
        return new Promise((resolve, reject) => {
            var options = {
                method: 'GET',
                uri: 'https://api.trello.com/1/boards/' + boardId + '/lists',
                qs: {
                    key: auth.APIKey,
                    token: auth.Token
                }
            };

            rp(options)
                .then(result => {
                    let jsonRes = JSON.parse(result);
                    let listId = jsonRes[1].id;
                    resolve({ auth: auth, listId: listId, cardData: cardData });
                })
                .catch(err => {
                    reject(err);
                });
        })
    }

    CreateCard(auth, listId, cardData) {
        let name = cardData.cardName;
        let description = cardData.cardDescription;
        return new Promise((resolve, reject) => {
            var options = {
                method: 'POST',
                uri: 'https://api.trello.com/1/cards',
                qs: {
                    key: auth.APIKey,
                    token: auth.Token,
                    idList: listId,
                    name: name,
                    desc: description,
                    idLabels: 'XXX'
                }
            };
            rp(options)
                .then(result => {
                    let jsonRes = JSON.parse(result);
                    resolve({ auth: auth, cardId: jsonRes.id, cardData: cardData });
                })
                .catch(err => {
                    reject(err);
                });
            
        })
    }

    CreateCheckList(data) {
        let cardId = data.cardId;
        let auth = data.auth;
        return new Promise((resolve, reject) => {
            var options = {
                method: 'POST',
                uri: 'https://api.trello.com/1/checklists',
                qs: {
                    key: auth.APIKey,
                    token: auth.Token,
                    idCard: cardId,
                }
            };

            rp(options)
                .then(result => {
                    let jsonRes = JSON.parse(result);
                    resolve({ auth: auth, checkListId: jsonRes.id, cardData: data.cardData });
                })
                .catch(err => {
                    reject(err);
                });
            
        })
    }

    CreateCheckItems(auth, checkListId, cardData, name, checked) {
        return new Promise((resolve, reject) => {
            var options = {
                method: 'POST',
                uri: 'https://api.trello.com/1/checklists/' + checkListId + '/checkItems',
                qs: {
                    key: auth.APIKey,
                    token: auth.Token,
                    name: name,
                    checked: checked,
                    pos: 'bottom'
                }
            };
            rp(options)
                .then(result => {
                    let jsonRes = JSON.parse(result);
                    resolve({ auth: auth, checkListId: checkListId, cardData: cardData });
                })
                .catch(err => {
                    reject(err);
                });
        })
        
    }
}

let importer = new TrelloImporter();
importer.ParseCSV();


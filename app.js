/*-----------------------------------------------------------------------------
A simple Language Understanding (LUIS) bot for the Microsoft Bot Framework. 
-----------------------------------------------------------------------------*/
require('dotenv-extended').load();
var restify = require('restify');
var builder = require('botbuilder');
var cognitiveservices  = require('botbuilder-cognitiveservices');


// Setup Restify Server
var server = restify.createServer();
server.listen(process.env.port || process.env.PORT || 3978, function () {
   console.log('%s listening to %s', server.name, server.url); 
});
  
// Create chat connector for communicating with the Bot Framework Service
var connector = new builder.ChatConnector({
    appId: process.env.MicrosoftAppId,
    appPassword: process.env.MicrosoftAppPassword,
    openIdMetadata: process.env.BotOpenIdMetadata 
});

// Listen for messages from users 
server.post('/api/messages', connector.listen());

//var tableName = 'botdata';
//var azureTableClient = new botbuilder_azure.AzureTableClient(tableName, process.env['AzureWebJobsStorage']);
//var tableStorage = new botbuilder_azure.AzureBotStorage({ gzipData: false }, azureTableClient);

// Create your bot with a function to receive messages from the user
// This default message handler is invoked if the user's utterance doesn't
// match any intents handled by other dialogs.
var bot = new builder.UniversalBot(connector, function (session, args) {
    session.send('You reached the default message handler. You said \'%s\'.', session.message.text);
});
//bot.set('storage', tableStorage);


// These cridentials are for LUIS
var luisAppId = process.env.LuisAppId;
var luisAPIKey = process.env.LuisAPIKey;
var luisAPIHostName = process.env.LuisAPIHostName || 'westus.api.cognitive.microsoft.com';
const LuisModelUrl = 'https://' + luisAPIHostName + '/luis/v2.0/apps/' + luisAppId + '?subscription-key=' + luisAPIKey;

// Create a recognizer that gets intents from LUIS, and add it to the bot
var recognizer = new builder.LuisRecognizer(LuisModelUrl);
console.log("Setting Up LUIS and QnA Maker cridentials");


// These cridentials for QnAMaker software KnowledgeBase
var recognizerqnaSoftware = new cognitiveservices.QnAMakerRecognizer({
    knowledgeBaseId: process.env.QNAknowledgeBaseIdSW,
    authKey: process.env.QNAauthKey,
    endpointHostName: process.env.QNAendpointHostName 
});

var QnAMakerDialogSoftware = new cognitiveservices.QnAMakerDialog({
    recognizers: [recognizerqnaSoftware],
    defaultMessage: 'No match with Software! Try changing the query terms!',
    qnaThreshold: 0.3
});

// These cridentials for QnAMaker hardware KnowledgeBase 
var recognizerqnaHardware = new cognitiveservices.QnAMakerRecognizer({
    knowledgeBaseId: process.env.QNAknowledgeBaseIdHW,
    authKey: process.env.QNAauthKey,
    endpointHostName: process.env.QNAendpointHostName 
});
  
var QnAMakerDialogHardware = new cognitiveservices.QnAMakerDialog({
    recognizers: [recognizerqnaHardware],
    defaultMessage: 'No match with Hardware! Try changing the query terms!',
    qnaThreshold: 0.3
});

bot.recognizer(recognizer,recognizerqnaHardware,recognizerqnaSoftware);

///
// QnAMaker Dialog Connections.
///
bot.dialog('qnasoftware', QnAMakerDialogSoftware);

bot.dialog('qnahardware', QnAMakerDialogHardware);


//This is a hero card for introduction
function createHeroCard(session) {
    return new builder.HeroCard(session)
        .title("Hi I'm IT Support Bot!")
        .subtitle('Your personalized digital asistant')
        .text("Hi I'm here to support, please ask any question you want, If you need assistant please type 'I need help' for to be guided for your issue")
        .images([
            builder.CardImage.create(session, 'https://blog.freshdesk.com/wp-content/uploads/2016/11/ML_Blog.jpg')
        ]);
}

///
// LUIS Dialog Connections.
// Add a dialog for each intent that the LUIS app recognizes.
// See https://docs.microsoft.com/en-us/bot-framework/nodejs/bot-builder-nodejs-recognize-intent-luis 
bot.dialog('GreetingDialog',
    (session) => {
        var card = createHeroCard(session);

        // attach the card to the reply message
        var msg = new builder.Message(session).addAttachment(card);
        session.send(msg);
    }
).triggerAction({
    matches: 'Greeting'
})

// These are prepopulated categories and sub categories
helpchoices = ["Hardware","Software","Office Goods","Other"];
softwarechoices = ["Excel","Word","PowerPoint","Outlook","Other"]
hardwarechoices = ["Laptop","Monitor","Keyboard","Mouse","DeskPhone", "Other"]
officegoodschoices = ["Printer", "Other"]

bot.dialog('HelpDialog',[
    function (session) {
        builder.Prompts.choice(session, "You reached the Help, How can I help you?", helpchoices); 
    },
    function (session, results) {
        if (results.response) {
            // These options are categories for the problem.
            if(results.response.entity === 'Software')
                builder.Prompts.choice(session, "Which Software you have an issue with?", softwarechoices);
            else if(results.response.entity === 'Hardware')
                builder.Prompts.choice(session, "Which Hardware you have an issue with?", hardwarechoices);
            else if(results.response.entity === 'Office Goods')
                builder.Prompts.choice(session, "Which Office Goods you have an issue with?", officegoodschoices);
            else 
                builder.Prompts.text(session, "Please can you provide your issue?");
        } else {
            session.send("OK");
        }
    },
    function (session, results) {
        // In below cases for seperated for each Service Item, 
        // In every case you can provide more spesific answer for users
        // Here are some sub category samples 
        console.log("-------------------");
        console.log(results.response);
        if (results.response) {
            if(results.response.entity === 'Excel' || results.response.entity === 'Word')
            {
                session.dialogData.searchType = 'software';
                // you can add custom message for spesific sub-category
                builder.Prompts.text(session, "I'll be helping for your '"+ results.response.entity + "' issue!, Please can you describe your issue?");           
            }
            else if(results.response.entity === 'Laptop' || results.response.entity === 'Monitor'|| results.response.entity === 'Keyboard' || results.response.entity === 'Mouse' || results.response.entity === 'Printer')
            {
                session.dialogData.searchType = 'hardware';
                builder.Prompts.text(session, "I'll be helping for your '"+ results.response.entity + "' issue!, Please can you describe your issue?");
            }
            else if(results.response.entity === 'DeskPhone')
            {
                // Or you can provide a solution directly like below instead of using QnAMaker
                session.send(`Please can you try the following:
                \n Check network cable from the floor port is plugged into the "NET" port on the phone.
                \n Restart the phone by pressing **#* on the handset!`);
            }
            else if(results.response.entity === 'Other')
                builder.Prompts.text(`Your issue is listed as other, I'll be happy to help please describe your issues!`);
            else 
                //send the query into other QnA KB. 
                session.send(`I'll be helping for your request: %s`, session.response);
        } else {
            session.send("OK");
        }
    },
    function (session, results) {
        if (results.response) {
            console.log("------------------");
            console.log(results.response);
            console.log("------------------");
            console.log(session.dialogData.searchType);
            
            if(session.dialogData.searchType === 'hardware')
                session.beginDialog('qnahardware');
            else if (session.dialogData.searchType === 'software')
            {
                console.log("Software QA triggered");    
                session.beginDialog('qnasoftware');
            }       
        } else {
            session.send("OK");
        }
    }
]
).triggerAction({
    matches: 'Help'
})

bot.dialog('CreateServiceRequest',[
    function (session, args, next) {

        var title = builder.EntityRecognizer.findEntity(args.entities, 'CreateServiceRequest');

        var entityhardware = builder.EntityRecognizer.findEntity(args.intent.entities, 'ServiceItem.Hardware');
        var entitysoftware = builder.EntityRecognizer.findEntity(args.intent.entities, 'ServiceItem.Software');
        var entityofficegoods = builder.EntityRecognizer.findEntity(args.intent.entities, 'ServiceItem.OfficeGoods');
        if (entityhardware != null)
        {
            session.dialogData.searchType = 'hardware';
            if(entityhardware.entity === "laptop")
            {
                session.send('Hardware SR: You are asking spesificially about: \'%s\'.', entityhardware.entity);
                builder.Prompts.text(session, 'What is your issue with your laptop?');
            }    
            else
            {
                session.send('Hardware SR: You are asking spesificially about: \'%s\'.', entityhardware.entity);
            }
            next({ response: entityhardware.entity });
            console.log(entityhardware);
            console.log(entityhardware.entity);
        }
        else if (entitysoftware != null)
        {
            session.dialogData.searchType = 'software';
            if(entitysoftware.entity === "excel")
            {
                //
                // If you would like to add another level knowledge base for a product
                // You can catch it here
                session.send('Excel - Software SR: You are trying to search about: \'%s\'.', entitysoftware.entity);
                //session.beginDialog('qnasoftware');
                //session.endDialog();      
            }
            else
            {
                session.send('Software SR: You are trying to Create a new Service Request for: \'%s\'.', entitysoftware.entity);
                session.endDialog();            
            }
            next({ response: entitysoftware.entity });
        }
        else if (entityofficegoods != null)
        {
            session.send('Office Goods SR: You are trying to Create a new Service Request for: \'%s\'.', entityofficegoods.entity);
            session.endDialog();
        }
    },
    function (session, results) {
        console.log('response result: %s',results.response);
        var userreply = results.response;

        if(session.dialogData.searchType === 'hardware')
            session.beginDialog('qnahardware');
        else if (session.dialogData.searchType === 'software')
            session.beginDialog('qnasoftware');
        else
        {
            var message = 'Looking for other issues: %s...';
            session.send(message, userreply);
            console.log('other result');    
        }
    }]
).triggerAction({
    matches: 'CreateServiceRequest'
})

bot.dialog('CancelDialog',
    (session) => {
        session.send('You reached the Cancel intent. You said \'%s\'.', session.message.text);
    }
).triggerAction({
    matches: 'Cancel'
})

import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import dayjs from "dayjs";
import { MongoClient } from "mongodb";
import Joi from "joi";


//configurations
const app = express();
app.use(cors());
app.use(express.json());
dotenv.config();

// mongo conection
let db;
const mongoClient = new MongoClient(process.env.DATABASE_URL);
mongoClient.connect()
 .then(() => db = mongoClient.db())
 .catch((err) => console.log(err.message))

 //schema
 const schemaUser = Joi.object({name: Joi.string().required()});
 const schemaMsg = Joi.object({
    from: Joi.string().required(),
    to: Joi.string().required(),
    text: Joi.string().required(),
    type: Joi.string().required().valid("message","private_message")
});

 //Endpoints
app.post("/participants", async(req, res) =>{
    const {name} = req.body;
    
    // data validation
    const validation = schemaUser.validate(req.body, {abortEarly: false});
    if(validation.error){
        const errors = validation.error.details.map(msgErr => msgErr.message);
        return res.status(422).send(errors);
    }

    try{
        // find if the user aready exists
        const userCreated = await db.collection("participants").findOne({name});
        if(userCreated) return res.status(409).send("Nome já cadastrado");

        const timestamp = Date.now();
        //array creation to send
        const incomingLogin = { 
            from: name,
            to: 'Todos',
            text: 'entra na sala...',
            type: 'status',
            time: dayjs(timestamp).format('HH:mm:ss')
        };

        //send the participant and incoming message
        await db.collection("participants").insertOne({name, lastStatus: timestamp})
        await db.collection("messages").insertOne(incomingLogin)
        res.sendStatus(201);

    }catch (err){
        res.send(err).sendStatus(500);
    }

    
    
});

app.get("/participants", async (req, res) => {
    
    //recieve participants 
    try {
       const data = await db.collection("participants").find().toArray();
        res.send(data);
    }catch (error) {
        res.send(error).sendStatus(500).send(error.message);
    }
});

app.post("/messages", async(req, res) =>{
    // get the body and header
    const {to, text, type} = req.body;
    const {user} = req.headers;

    //data validation
    const validation = schemaMsg.validate({...req.body, from: user}, {abortEarly: false});
    if(validation.error){
        const errors = validation.error.details.map(msgErr => msgErr.message);
        return res.status(422).send(errors);
    };

    //try to send 
    try{
        //verify if the participant is online
        const useroff = await db.collection("participants").findOne({name: user});
        if(!useroff) return res.status(422).send("usuário offline");
        
        //build the message to send
        const newMessage = {from: user, to, text, type, time: dayjs().format('HH:mm:ss')};
        //send newMessage to the front
        await db.collection("messages").insertOne(newMessage)
        res.sendStatus(201)

    }catch(err){
        res.send(err).sendStatus(500);
    }
});

app.get("/messages", async (req, res) =>{
    // get headers and query
    const {user} = req.headers
    const{limit} = req.query

    // verify of limit is not undefined, zero, negative and not a number (Nan). If true, returns error
    if(limit!== undefined && (Number(limit) <=0 || isNaN(Number(limit)))) return res.sendStatus(422)
        
    //try to send message
        try {
            // find the type, from and to the massage is been sending, sort the latest messagens
            // if limit is undefined, retuns 0 and then, will returns all messagens
            const message = db.collection("messages")
                .find({$or: [{from: user}, {to: "Todos"}, {type: "message"}]})
                .sort({ time:-1 })
                .limit(limit ===undefined ? 0 : Number(limit))
                .toArray()
            res.send(message);
        } catch (error) {
            res.status(500).send(error.message)
        }

    
});

app.post("/status", async (req, res)=> {
    const { user } = req.headers

    if (!user) return res.sendStatus(404)

    try {
        // const participant = await db.collection('participants').findOne({ name: user })
        // if (!participant) return res.sendStatus(404)

        const result = await db.collection('participants').updateOne(
            { name: user }, { $set: { lastStatus: Date.now() } }
        )

        if (result.matchedCount === 0) return res.sendStatus(404)

        res.sendStatus(200)
    } catch (err) {
        res.status(500).send(err.message)
    }

});

setInterval(async()=>{

    const tenSecAgo = Date.now() - 10000
    try {
        const offlineUsers = await db.collection("participants")
        .find({lastStatus: {$lt: tenSecAgo}})
        .toArray()

        if(offlineUsers.length > 0){
            const messagesoff =offlineUsers.map(user => {
                return{
                    from:user.name,
                    to:'Todos',
                    text:'sai da sala...',
                    type:'status',
                    time:dayjs().format('HH:mm:ss')
                }
            })
            await db.collection("messages").insertMany(messagesoff);
            await db.collection("participants").deleteMany({lastStatus: {$lt: tenSecAgo}})
        }
        
    } catch (error) {
        console.log(error)
    }
}, 15000)

const PORT = 5001;
app.listen(PORT, () => console.log(`Servidor Quiz rodando na porta ${PORT}`));

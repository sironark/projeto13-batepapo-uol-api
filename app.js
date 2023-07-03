import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import dayjs from "dayjs";
import { MongoClient } from "mongodb";
import Joi from "joi";



const app = express();
app.use(cors());
app.use(express.json());

dotenv.config();


let db;
const mongoClient = new MongoClient(process.env.DATABASE_URL);

mongoClient.connect()
 .then(() => db = mongoClient.db())
 .catch((err) => console.log(err.message))




app.post("/participants", async(req, res) =>{
    const {name} = req.body;
    const schemaUser = Joi.object({
        name: Joi.string().required()
    });

    const validation = schemaUser.validate(req.body, {abortEarly: false});
    if(validation.error){
        const errors = validation.error.details.map(msgErr => msgErr.message);
        return res.status(422).send(errors);
    }

    const newUser = {
        name,
        lastStatus : Date.now()
    };
    const login = { 
        from: name,
        to: 'Todos',
        text: 'entra na sala...',
        type: 'status',
        time: dayjs().format('HH:mm:ss')
};

    try{

        const userCreated = await db.collection("participants").findOne(req.body);
        if(userCreated) return res.status(409).send("Nome já cadastrado");

        await db.collection("participants").insertOne(newUser);
        await db.collection("messages").insertOne(login);
        res.sendStatus(201);


    }catch (err){
        res.send(err).sendStatus(500);
    }

    
    
});

app.get("/participants", (req, res) => {
    
    const promisse =db.collection("participants").find().toArray();
    promisse.then(data => res.send(data));
    promisse.catch(error => res.status(500).send(error.message));
});

app.post("/messages", async(req, res) =>{
    const {to, text, type} = req.body;
    
    const user = req.headers.user;
    const newMessage = {from: user, to, text, type, time: dayjs().format('HH:mm:ss')};
    console.log(req.headers)
    const schemaMsg = Joi.object({
            to: Joi.string().required().min(1),
            text: Joi.string().required().min(1),
            type: Joi.string().required().valid("message","private_message")
    });

    const validation = schemaMsg.validate(req.body, {abortEarly: false});
    if(validation.error){
        const errors = validation.error.details.map(msgErr => msgErr.message);
        return res.status(422).send(errors);
    };

    const schemaFrom = Joi.object({from: Joi.required()});
    
    const validation2 = schemaFrom.validate(req.headers.from,{abortEarly: false});
    if(validation2.error){
        const errors = validation2.error.details.map(msgErr=>msgErr.message);
        return res.status(422).send(errors);
    };



    try{
        const useroff = await db.collection("participants").findOne({name: user});
        if(!useroff) return res.status(422).send("usuário offline");

        await db.collection("messages").insertOne(newMessage);
        res.sendStatus(201)
    }catch(err){
        res.send(err).sendStatus(500);
    }
    

});

app.get("/messages", (req, res) =>{

    const limit = parseInt(req.query.limit);

    if (limit <= 0 || limit === ""){
         return res.status(422).send("Unprocessable Entity");
    } else{
        const promisse = db.collection("messages").find().toArray();
        promisse.then(data => {
            return res.send(data);
        });
        promisse.catch(error => {
            return res.status(500).send(error.message);
        });
    };
    
});

app.post("/status", (req, res)=> {
    if(req.headers.user){
        res.send(req.headers.user);
    }else{
        res.send(req.headers.user).sendStatus(404);
    };
    
});

const PORT = 5000;
app.listen(PORT, () => console.log(`Servidor Quiz rodando na porta ${PORT}`));

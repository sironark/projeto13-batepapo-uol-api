import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import dayjs from "dayjs";
import { MongoClient } from "mongodb";



const app = express();
app.use(cors());
app.use(express.json());

dotenv.config();


let db;
const mongoClient = new MongoClient(process.env.DATABASE_URL);

mongoClient.connect()
 .then(() => db = mongoClient.db())
 .catch((err) => console.log(err.message))

const users = [];
const messages =[];


app.post("/participants", (req, res) =>{
    const {name} = req.body;
    if(!req.body.name){
        res.sendStatus(422);
    }else{
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

        const promisse = 
            db.collection("participants").insertOne(newUser);
            db.collection("messages").insertOne(login);
        
        promisse.then(() => res.sendStatus(201))
  
    }
});

app.get("/participants", (req, res) => {
    
    const promisse =db.collection("participants").find().toArray();
    promisse.then(data => res.send(data));
    promisse.catch(error => res.status(500).send(error.message));
});

app.post("/messages", (req, res) =>{
    const {to, text, type} = req.body;
    const user = req.headers.user;
    const newMessage = {from: user, to, text, type, time: dayjs().format('HH:mm:ss')};

    const promisse = 
    db.collection("messages").insertOne(newMessage);
    promisse.then(() => res.sendStatus(201))

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

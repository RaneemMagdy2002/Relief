const express=require("express")
const bodyParser = require("body-parser")
const cors=require("cors")
const xss=require("xss-clean")
const helmet=require("helmet")
require("dotenv").config()
const app = express();
app.use(bodyParser.urlencoded({extended:true}))
app.use(bodyParser.json())
const path = require('path');


app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));


const DB_connect=require('./Database/Users_DB')

DB_connect()



app.use(helmet({
    contentSecurityPolicy:false,
    frameguard:false
}))
app.use(cors())
app.use(xss())


const UserRout=require("./Routes/UsersRoutes")
app.use('/api/V1',UserRout)

app.get('/payment/:requestId', (req, res) => {
    res.render('payment', { requestId: req.params.requestId });
});

app.listen(process.env.PORT||8000,()=>{
    console.log('Server is Running on Port 8000 .......')
})
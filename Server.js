// #10. 환경변수 별도저장을 위한 set up
require('dotenv').config()

const express = require('express')
const app = express()
// #3. Server 와 Mongodb 연결 코드 , #6 Objectid 가져오기 위해 파라미터 추가
const { MongoClient, ObjectId } = require('mongodb')
// #6. post,get 외에 put delete 사용을 위한 set up 
const methodOverride = require('method-override')
app.use(methodOverride('_method')) 
// #8. 해싱(암호화)를 위한 bcrypt set up
const bcrypt = require("bcrypt")
// #9. 세션을 db에 저장하기 위해 connect mongo setup
const MongoStore = require("connect-mongo")
// #7. 회원기능을 위한 passport 라이브러리 사용 set up
const session = require('express-session')
const passport = require('passport')
const LocalStrategy = require('passport-local')
// #11. s3에 이미지 등록을 위한 multer 라이브러리 set up
const { S3Client } = require('@aws-sdk/client-s3')
const multer = require('multer')
const multerS3 = require('multer-s3')
const s3 = new S3Client({
  region : 'ap-northeast-2', // AWS 서울
  credentials : {
      accessKeyId : process.env.AWS_acckey,
      secretAccessKey : process.env.AWS_seckey
  }
})

const upload = multer({
  storage: multerS3({
    s3: s3,
    bucket: "lazzyoungforum1",
    key: function (request, file, cb) {
      cb(null, Date.now().toString()) //업로드시 파일명 변경가능
    }
  })
})
// 쿠키생성
app.use(passport.initialize())
app.use(session({
  secret: process.env.encodingPW,
  resave : false,
  saveUninitialized : false,
  cookie : {maxAge : Number(process.env.Cookie_age)},
  store : MongoStore.create({
    mongoUrl : process.env.DB_URL,
    dbName : process.env.DB_NAME
  })
}))

app.use(passport.session()) 

// #2. Server 에 public 이라는 폴더 추가
app.use(express.static(__dirname + '/public'))
// #4. ejs 세팅
app.set('view engine' , 'ejs');
// #5.(request.body 세팅 명령어
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
// #n. router 불러오기
app.use('/',require('./Routes/shop.js'))

// DB 구축
let connectDB = require('./database.js')

let db
connectDB.then((client)=>{
    console.log('DB연결성공')
    db = client.db(process.env.DB_NAME)
  // #1. Server 생성 코드
    app.listen(process.env.PORT, () => {
})
}).catch((err)=>{
  console.log(err)
})



app.get('/',(request , response)=> {
    
    response.sendFile(__dirname + '/index.html')
})  
app.get('/about',(request , response)=> {
    
    response.sendFile(__dirname + '/introduce.html')
})
app.get('/time',(request , response)=> {
    
    // db.collection('post').insertOne({title : '맑음'});
    // response.sendFile(__dirname + '/introduce.html')
    response.render("time.ejs", {"Servertime" : new Date()});
})  

app.get('/list', async(request , response)=> {
    
    let content = await db.collection('post').find().toArray();
    // response.render("list.ejs", { "textlist" : content});
    response.redirect('/list/page/1')
})
//이거 복구해야함, page 별로 나누는거랑 detail page 로가는거랑 곂침
app.get('/list/page/:pagenum', async(request , response)=> {
    
    let content = await db.collection('post').find().skip((request.params.pagenum-1)*5).limit(5).toArray();
    response.render("list.ejs", { "textlist" : content});
})
app.get('/list/:postid',async(request,response)=> {
    
    try { 

        let detailpost = await db.collection('post').findOne({_id : new ObjectId(request.params.postid)});
        let detailcomment = await db.collection('comments').find({parentId : new ObjectId(request.params.postid)}).toArray()
        response.render('detail.ejs',{ "detailpost" : detailpost , "detailcomment" : detailcomment })

        console.log(detailcomment)

        if (detailpost == null){ // Post id의 길이나 순서가 맞는것으로 인식해 db에서 찾기까지했음 하지만없는 데이터라 null 로 표시
            response.status(404).send("존재하지 않는 글입니다.")
        }
    }
    catch(Errcode_404) {
        console.log(Errcode_404)
        response.status(404).send("존재하지 않는 글입니다.")
        // 400 : 유저 잘못, 500: 서버 잘못
    }
})
app.post('/list/search',async(request,response)=> {
    
    
    let 검색조건 = [
        {$search : {
          index : 'title_index',
          text : { query : request.body.title , path : 'title' }
        }},
        { $sort : { _id : 1 } },
        // { $limit : 10 },
        // { $project : { 제목 : 1, _id : 0 } }
      ] 
    let keyword = await db.collection('post').aggregate(검색조건).toArray()
        console.log(keyword)
        response.render('search.ejs', { "keyword" : keyword} )
        
})

app.get('/write',async(request , response)=> {

    response.render("write.ejs");
})  
app.get('/register',async(request , response)=> {

    response.render("register.ejs");
})  
app.get('/login',async(request , response)=> {
    console.log(request.user)
    response.render("login.ejs");
})  
app.get('/edit/:postid',async(request , response)=> {
    
    let detailpost = await db.collection('post').findOne({_id : new  ObjectId(request.params.postid)})
    response.render("edit.ejs", {"detailpost" : detailpost});
})  



app.post('/newpost',async(request,response) => {

    //request.file or files 로 저장된 URL 및 다른 정보들 확인 가능 , 이미지 URL 은 location
    upload.array('image', 3)(request, response, async(err)=>{
        if (err) return response.send("이미지 업로드 에러")
        try {
            if (request.body.title == "") {
                response.send("제목을 작성해주세요");   
            }
            else if (request.body.content == "") {
                response.send("내용을 작성해주세요");   
            }
            else {
                //map Loop ver
                const imageLocations = request.files.map(file => file.location);

                //for Loop ver
                // const imageLocations = [];
                // for (let i = 0; i < request.files.length; i++) {
                //     imageLocations.push(request.files[i].location);
                // }

                await db.collection('post').insertOne({
                    "title":request.body.title , 
                    "content":request.body.content, 
                    "image" : imageLocations,
                    
                    });
                response.redirect("/list")
                console.log("작성완료")
            }                                   
        }
        catch(Errcode_500) {
            response.send("Error code(500) : Server error")
            console.log(Errcode_500)
         }

    })

    
    
})
app.post('/register',async(request,response) => {
    
    try {
        if ((request.body.username == "") ||(request.body.username == undefined )) {
            response.send("아이디를 입력해주세요!");   
        }
        else if ((request.body.password == "") || (request.body.password == undefined)) {
            response.send("비밀번호를 입력해주세요!");   
        }
        else {
            let hashPW = await bcrypt.hash(request.body.password,10)
            await db.collection('user').insertOne({
                "username":request.body.username , 
                "password":hashPW});
            // response.write("<script>alert('가입완료')</script>");
            response.send("가입완료")

        }                                   
    }
    catch(Errcode_500) {
        response.send("Error code(500) : Server error")
        console.log(Errcode_500)
     }
    
})

// passport 이용해서 db에 유저가 입력한 ID , PW 가있는지 확인
// +a) 내가 name 속성 준걸로 변경
passport.use(new LocalStrategy(async (username, password, cb) => {
    
    let result = await db.collection('user').findOne({ username: username });
    if (!result) {
        console.log('Username:', username);
        return cb(null, false, { message: '존재하지않는 아이디입니다.' });
    }
    // 해싱한 pw 와 pw를 비교하기위해 bcrypt의 compare(해싱전,해싱후)이용
    
    if (await bcrypt.compare(password,result.password)) {
        return cb(null, result);
    } else {
        console.log('Password:',result.password);
        return cb(null, false, { message: '비밀번호가 일치하지 않습니다.' });
    }
    
    
}));
  
// 쿠키 생성 코드
passport.serializeUser((user, done) => {
process.nextTick(() => {
    done(null, { id: user._id, username: user.username })
})
})
// 쿠키 검토 코드 -> 이후 부터 request.user 하면 user 정보 볼수있ㅇㅁ
passport.deserializeUser(async(user, done) => {
    let result = await db.collection('user').findOne({ _id : new ObjectId(user.id) })
    delete user.password
    process.nextTick(() => {
      return done(null, result)
    })
  })

app.get('/login',async(request , response)=> {
    console.log(request.user)
    response.render("login.ejs");
})  
app.get('/mypage',async(request , response)=> {
    console.log(request.user)
    response.render("mypage.ejs");
})  
app.post('/login',async(request,response,next) => {
    
    passport.authenticate('local', (error, user, info) => {
        if (error) return response.status(500).json(error)
        if (!user) return response.status(401).json(info.message)
        request.logIn(user, (err) => {
            if (err) return next(err)
         response.redirect('/')
        })
    })(request, response, next)
    
})
// 수정기능을 put 으로 사용하여 적용
app.put('/editpost/:postid',async(request,response) => {
    
    db.collection('post').updateOne(
        {_id: new ObjectId(request.params.postid)} , 
        {$set : { title : request.body.title, content : request.body.content}});
            response.redirect("/list")
            console.log("수정 완료")
    
})

app.delete('/delete',async(request, response)=>{

    await db.collection('post').deleteOne({_id: new ObjectId(request.query.docid)} ) 
    response.send("삭제완료")
    
})

app.post('/comment', async(request, response)=>{
    
    await db.collection('comments').insertOne({
        "comment" : request.body.comment ,
        "writerId" : new ObjectId(request.user._id),
        "writer" : request.user.username,
        "parentId" : new ObjectId(request.body.parentId)
    })
    
    response.redirect('back')
})



  





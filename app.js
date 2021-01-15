const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database(__dirname + '/users.db',
    function (err) {
        if (!err) {
            db.run(`
                CREATE TABLE IF NOT EXISTS user (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                email TEXT UNIQUE,
                password TEXT,
                name TEXT,
                admin Boolean,
                status BOOLEAN
            )`);
            db.run(`
                CREATE TABLE IF NOT EXISTS sheet (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                userID INTEGER,
                title TEXT UNIQUE,
                email TEXT,
                data TEXT,
                sharable BOOLEAN,
                sharedWith TEXT
                )
            `);
            db.run(`
            CREATE TABLE IF NOT EXISTS shared (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                sheetID INTEGER,
                email TEXT
                )
            `);
            console.log('opened users.db');
        } else {
            console.log(err);
        }
    });
const express = require('express');
const hbs = require('express-hbs');
const bodyParser = require('body-parser');
const nodemailer = requier('nodemailer');
const CSV = require('csv-string');
const jsonParser = bodyParser.json();
const textBody = bodyParser.text();
const cookieSession = require('cookie-session');
const app = express();
//const md5 = require('md5');
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(__dirname + '/public'));

app.engine('hbs', hbs.express4({
    partialsDir: __dirname + '/views/partials',
    defaultLayout: __dirname + '/views/layout/main.hbs'
}));

app.set('view engine', 'hbs');
app.set('views', __dirname + '/views');

const port = process.env.PORT || 8000;

app.use(cookieSession({
    name: 'session',
    secret: 'foo'
}));

// middleware to log requests
// app.use(function (req, res, next) {
//     const d = Date.now();
//     console.log(`time: ${d} method: ${req.method} url: ${req.url}`);
//     next();
// });

function authenticator(req, res, next) {
    if (req.session.email) {
        next();
    } else {
        res.redirect('/login');
    }
}

app.get('/', authenticator, function (req, res) {
    console.log("home: ", req.session.email, ": ", req.session.name);
    res.type('.html');
    res.render('home', {
        title: "Homepage",
    });
});


app.get('/login', function (req, res) {
    if (req.session.email) {
        res.redirect('status');
    } else {
        res.type('.html');
        res.render('login', {
            title: "Login"
        });
    }

});

app.post('/login', function (req, res) {
    var data = req.body;
    var success = false;
    db.get(`SELECT * FROM user WHERE email=?`, [data.email.toLowerCase()], function (err, row) {
        console.log("rows: ", row);
        if (row != undefined) {
            console.log("Success: ", success);
            if (row.password === data.password) {
                success = true;
                console.log("Success: ", success);
                req.session.email = row.email.toLowerCase();
                req.session.name = row.name;
                req.session.id = row.id;
                req.session.admin = row.admin;
                console.log(req.session.admin);
                if (req.session.admin) {
                    console.log(req.session.admin);
                    res.redirect('/adminPage');
                } else {
                    res.redirect('/status');
                }
            } else if (row.password !== data.password) {
                res.render('login', {
                    alert: "warning-yellow",
                    message: "password not match"
                })
            }
        } else {
            res.type('.html');
            res.render('login', {
                alert: "danger-red",
                message: "Wrong email!"
            });
        }

    });
});


app.get('/status', authenticator, function (req, res) {
    if (!req.session.email && !req.session.password) {
        res.redirect('/login');
    }
    else {
        res.type('.html');
        res.render('Userstatus', {
            sess: req.session,
            title: "Account Details"
        });

    }

});

app.get('/adminPage', authenticator, function (req, res) {
    console.log("level: ", req.session.admin);
    console.log("session name", req.session.name);
    if (req.session.admin === 1) {
        db.all('SELECT * FROM user', function (err, rows) {
            if (rows != undefined) {
                res.render('adminPage', {
                    sess: req.session,
                    user: rows,
                    title: "Admin Page"
                });
            }

        });
    } else {
        res.redirect('/');
    }

});

app.get('/Delete/:id', function (req, res) {
    let id = req.params.id;
    console.log("id: ", id);
    db.run('DELETE FROM user WHERE id=?', id);
    res.redirect('/adminPage');
});

app.post('/Register', function (req, res) {
    console.log("=============================");
    //console.log(res.body.email);
    if (req.body.email && req.body.password && req.body.name) {
        let email = req.body.email.toLowerCase();
        console.log(email);
        let name = req.body.name.toUpperCase();
        var admin = req.body.admin;
        db.serialize(function () {
            db.get(`SELECT * FROM user WHERE email=?`, [email], function (err, row) {
                //let rowEmail = row.email.toLowerCase();
                if (row == undefined) {
                    console.log("email is available!");
                    if (req.body.confimrPassword === req.body.password) {
                        db.run(`INSERT INTO user(email,password,name,admin,status)
        VALUES(?,?,?,?,?)`, [email, req.body.password, name, admin, 1]);
                        req.session = null;
                        res.type('.html');
                        res.render('Register', {
                            alert: "good-blue",
                            message: 'Account created successfully! '
                        });

                    } else {
                        res.type('.html');
                        res.render('Register', {
                            alert: "warning-yellow",
                            message: 'Password is not match!'
                        });
                    }

                }
                else if (row.email === email) {
                    res.type('.html');
                    res.render('Register', {
                        alert: "warning-yellow",
                        message: "Email already exist!"
                    });
                }
            })
        }
        );


    } else {
        res.type('.html');
        res.render('Register', {
            alert: "danger-red",
            message: "Some fields are empty!"
        });

    }
});

app.get('/logout', function (req, res) {
    req.session = null;
    res.redirect('/');
});

app.get('/Register', function (req, res) {
    res.type('.html');
    res.render('Register', {

        sess: req.session,
        title: 'Register'
    });
});


app.get('/Edit:id', authenticator, function (req, res) {
    if (req.params.id) {
        if (req.session.id == req.params.id) {
            res.render('Edit', {
                title: "Modification",
                sess: req.session
            });
        } else if (req.session.admin === 1) {
            let id = req.params.id;
            db.get('SELECT * FROM user WHERE id=?', [id], function (err, row) {
                console.log(row);
                if (row !== undefined) {
                    res.render('Edit', {
                        sess: row,
                        title: "Users Modification"
                    });

                }
            });
        } else {
            res.redirect('/');
        }

    } else {
        console.log("err");
        res.render('Edit', {
            title: "Modification",
            sess: req.session

        });
    }
});


app.get('/sheet_edit', jsonParser, authenticator, (req, res) => {
    let name = req.query['name'];
    console.log("HERE WE GO", name);
    db.get(`SELECT * FROM sheet where title = ?`, [name], (err, row) => {
        if (!err) {
            res.type('.html');
            res.render('SpreadSheetLoad', {
                sheet: row,
                title: 'Edit Sheet'
            });
        }
    });
});

app.post('/Edit:id', authenticator, function (req, res) {
    if (req.session.id != req.params.id) {
        console.log("yes");
        console.log(req.params.id);
        if (req.body.password) {
            let password = req.body.password;
            let id = req.params.id;
            if (req.body.password !== req.body.password2) {
                db.get('SELECT * FROM user WHERE id=?', [id], function (err, row) {
                    console.log(row);
                    if (row !== undefined) {
                        res.render('Edit', {
                            sess: row,
                            title: "Users Modification",
                            alert: "warning-yellow",
                            message: "password is not match!"
                        });
                    }
                });
            }
            else if (req.body.password === req.body.password2) {
                db.serialize(function () {
                    db.run('UPDATE user SET password=? WHERE id=?', [password, id], function (err) {
                        if (err) {
                            console.log("error for updating user's account: ", err);
                        } else {
                            console.log("updated");
                            db.get('SELECT * FROM user WHERE id=?', [id], function (err, row) {
                                console.log(row);
                                if (row !== undefined) {
                                    res.render('Edit', {
                                        sess: row,
                                        title: "Users Modification",
                                        alert: "good-blue",
                                        message: "password changed!"
                                    });
                                }
                            });

                        }
                    });
                });
                if (req.body.name) {
                    let name = req.body.name;
                    let id = req.params.id;
                    db.serialize(function () {
                        db.run('UPDATE user SET name=? WHERE id=?', [name, id], function (err) {
                            if (err) {
                                console.log("error for updating user's account: ", err);
                                res.send("ERROR OCCURED! Method: Edit : ", err);
                            } else {
                                console.log("updated");
                                db.get('SELECT * FROM user WHERE id=?', [id], function (err, row) {
                                    console.log(row);
                                    if (row !== undefined) {
                                        res.render('Edit', {
                                            sess: row,
                                            title: "Users Modification",
                                            alert: "good-blue",
                                            message: "Name changed!"
                                        });
                                    }
                                });
                            }
                        });
                    });


                }

            }

        } else if (req.body.name) {
            let name = req.body.name;
            let id = req.params.id;
            db.serialize(function () {
                db.run('UPDATE user SET name=? WHERE id=?', [name, id], function (err) {
                    if (err) {
                        console.log("error for updating user's account: ", err);
                        res.send("ERROR OCCURED! Method: Edit : ", err);
                    } else {
                        console.log("updated");
                        db.get('SELECT * FROM user WHERE id=?', [id], function (err, row) {
                            console.log(row);
                            if (row !== undefined) {
                                res.render('Edit', {
                                    sess: row,
                                    title: "Users Modification",
                                    alert: "good-blue",
                                    message: "Name changed!"
                                });
                            }
                        });
                    }
                });
            });

        }

    } else {
        if (req.body.password) {
            if (req.body.password === req.body.password2) {
                req.session.password = req.body.password;
                var password = req.body.password;
                var email = req.session.email.toLowerCase();
                let data = [password, email];
                let sql = 'UPDATE user SET password=? WHERE email=?';
                db.run(sql, data, function (err) {
                    if (err) {
                        return console.error(err.message);
                    }
                    console.log(`Row(s) updated: ${this.changes}`);
                });
            }
            else {
                res.type('.html');
                res.render('Edit', {
                    sess: req.session,
                    title: "Edit",
                    alert: "warning-yellow",
                    message: "Password is not match!"
                });
            }

        } if (req.body.name) {
            req.session.name = req.body.name;
            var name = req.body.name;
            var email = req.session.email.toLowerCase();
            let data = [name, email];
            let sql = 'UPDATE user SET name=? WHERE email=?';
            db.run(sql, data, function (err) {
                if (err) {
                    return console.error(err.message);
                } else {
                    console.log(`Row(s) updated: ${this.changes}`);
                    res.type('.html');
                    res.render('Edit', {
                        sess: req.session,
                        title: "edit",
                        alert: "good-blue",
                        message: "Information is now changed!"
                    });


                }

            });
        }
    }

});

app.get('/spreadsheet', authenticator, function (req, res, next) {
    console.log(req.session.id);
    if (req.session.admin === 1) {
        db.all('SELECT * FROM sheet', function (err, rows) {
            // console.log("sheets: ", rows)
            for(let k=0; k<rows.length;k++){
                rows[k].isOwner = true;
            }
            if (rows != undefined) {
                res.render('SpreadSheetList', {
                    sheet: rows,
                    title: "SpreadSheets"
                });
            } else {
                res.render('SpreadSheetList', {
                    message: "There is no spreadSheet created."
                });
            }
        });
    } else {
        //need shared with
        let subQuery = `SELECT * FROM sheet WHERE (userID=? OR id in (SELECT sheetID FROM shared WHERE email like '%${req.session.email}%'))`;
        console.log("QUERY: ", subQuery);
        let sameAuthor = {};

        db.all(subQuery, [req.session.id], (err, rows) => {
            if (rows != undefined) {
                for (let i = 0; i < rows.length; i++) {
                    if (req.session.email != rows[i].email) {
                        rows[i].isOwner = false;
                    } else {
                        rows[i].isOwner = true;
                    }

                }
                res.render('SpreadSheetList', {
                    sheet: rows,
                    title: "List of SpreadSheet"

                });
                //console.log("ROWS: ", rows);
            } else {
                res.render('SpreadSheetList', {
                    message: "There is no spreadSheet created."
                });
                //console.log("err",err);
            }
        });

    }
});

app.get('/createSpreadSheet', authenticator, function (req, res, next) {
    res.render('addNewSpreadSheet');
});

app.put('/sheet/:name', jsonParser, authenticator, function (req, res) {
    const name = req.params.name;
    const origName = req.body.originalName;
    //const bodyValues = req.body.value;
    const values = req.body.value;
    console.log("values.value", req.body.value);
    const strValues = JSON.stringify(values);

    if (req.body.origName !== undefined) {
        console.log("email achieved! ", req.body.author);
        db.serialize(function () {
            db.get(`SELECT * FROM sheet WHERE title=?`, [name], (err, rows) => {
                if (!err) {
                    console.log("rows", rows);
                    if (rows == undefined) {
                        db.run(`UPDATE sheet SET title = ?,data = ?, sharable = ? WHERE id = ?`, [name, values, "True", req.body.excelID], (err, row) => {
                            if (!err) {
                                console.log("updated 1");
                                res.send({ ok: true }); // converts to JSON
                            }
                            else {
                                console.log("failed to update");
                                res.send({ ok: false }); // converts to JSON
                            }
                        });

                    } else {
                        res.send({ message: "Name of spreadSheet already exist! Try other name" });
                    }
                }
            });

        });

    }
    else {

        console.log("data: ", strValues);
        db.run(`UPDATE sheet SET data = ?, sharable = ? WHERE id = ?`, [strValues, "True", req.body.excelID], (err, row) => {
            if (!err) {
                console.log("updated");
                res.send({ ok: true }); // converts to JSON
            }
            else {
                console.log("failed to update");
                console.log("err", err);
                res.send({ ok: false }); // converts to JSON
            }
        });
    }


});

app.get('/copy', jsonParser, authenticator, function (req, res) {
    const id = req.query['name'];
    const name = req.query['name2'];
    let newName = name + "_copied";
    if (name == newName) {
        newName = newName + "_1";
    }
    console.log('id', id);
    const author = req.session.email;
    const sharable = "True";
    db.get(`SELECT data FROM sheet WHERE title=?`, [name], function (err, row) {
        if (!err) {
            if (row != undefined) {
                db.run(`INSERT INTO sheet (userID,title,email,data,sharable) VALUES(?,?,?,?,?)`,
                    [req.session.id, newName, req.session.email, row.data, sharable],
                    function (err) {
                        if (!err) {
                            console.log("sucess");
                            res.redirect('spreadsheet');// converts to JSON
                        }
                        else {
                            console.log("failure");
                            console.log("err: ", err);
                            res.send({ ok: false }); // converts to JSON
                        }
                    }
                );

            }

        } else {
            res.send({err:err});

        }
    });

});

app.get('/delete', jsonParser, authenticator, function (req, res) {
    const id = req.query['name'];
    console.log('id', id);
    db.serialize(function(){
        db.run(`DELETE FROM sheet WHERE id=?`,[id],function(err,row){
            if(!err){
                db.run(`DELETE FROM shared WHERE sheetID=?`,[id],function(err,row){
                    if(!err){
                        res.redirect('spreadsheet');
                    }else{
                        res.send({err:err});
                    }
                }); 
            }else{
                res.send({err:err});
            }
        });
        
    }
        
    );
});


app.put('/createSheet/:name', jsonParser, authenticator, function (req, res) {
    const name = req.params.name;
    const values = req.body;
    const data = values.tableInputs;
    const sharable = values.sharable;
    console.log('sharable', sharable);
    const strValues = JSON.stringify(data);
    console.log("data: ", strValues);
    db.serialize(function () {
        db.get(`SELECT * FROM sheet WHERE title=? `, [name], function (err, rows) {
            if (rows == undefined) {
                db.run(`INSERT OR REPLACE INTO sheet (userID,title,email,data,sharable) VALUES(?,?,?,?,?)`,
                    [req.session.id, name, req.session.email, strValues, sharable],
                    function (err) {
                        if (!err) {
                            console.log("sucess");
                            res.send({ ok: true }); // converts to JSON
                        }
                        else {
                            console.log("failure");
                            console.log("err: ", err);
                            res.send({ ok: false }); // converts to JSON
                        }
                    }
                );
            }
            else {
                console.log("failed creation, title already exist");
                res.send({ message: "title already exist!" });
            }
        });

    }

    );



});


app.put('/csv-export', jsonParser, (req, res) => {
    const name = req.params.name;
    const values = req.body;
    let csv = '';
    for (let row of values) {
        csv += CSV.stringify(row);
    }
    res.set('Content-Type', 'text/plain')
    res.send(csv);
});




app.get('/csv-export/:name', authenticator, jsonParser, (req, res) => {
    const name = req.params.name;
    db.get('SELECT data FROM sheet WHERE title=?', [name],
        function (err, row) {
            if (!err) {
                let values = JSON.parse(row.data);
                let csv = ''
                for (let row of values) {
                    csv += CSV.stringify(row);
                }
                res.set('Content-Type', 'text/plain')
                // tell the browsers to down load to a file
                res.set('Content-Disposition',
                    `attachment; filename="${name}.csv"`);
                res.send(csv);
            }
            else {
                res.status(404).send("not found");
            }
        });

});

app.put('/csv-import/:name', textBody, (req, res) => {
    console.log("importcalled");
    const name = req.params.name;
    const sheet = [];
    console.log('importing', req.body);
    // parse the CSV
    CSV.forEach(req.body, ',', function (row, index) {
        sheet.push(row);
    });
    const strValues = JSON.stringify(sheet);
    // insert it into the data base
    db.run(`INSERT OR REPLACE INTO sheet (title,data,email,sharable) VALUES(?,?,?,?)`,
        [name, strValues, req.session.email, "True"],
        function (err) {
            if (!err) {
                res.send({ ok: true }); // converts to JSON
            }
            else {
                res.send({ ok: false }); // converts to JSON
            }
        }
    );
});

app.get('/shareStatus/', authenticator, function (req, res, next) {
    let sheetID = req.query['name'];
    db.get(`SELECT * FROM sheet WHERE id=?`, [sheetID], function (err, row) {
        console.log("ROW: ", row);
        if (row != undefined) {
            res.type('.html');
            res.render('shareStatus', {
                sheet: row,
                title: "Share SpreadSheets"
            });
        } else {
            res.send({ err: err });
        }
    });
});

app.put('/satusChanged/:name', jsonParser, authenticator, function (req, res) {
    console.log("enter put sharestatus");
    let sheetID = req.params.name;
    console.log("sheetID: ", sheetID);
    const email = req.body.emails;
    console.log(email);
    //let email = JSON.parse(req.body.emails);
    //console.log("emaail,", email);
    const strValues = JSON.stringify(email);
    console.log("strvalues: ", strValues);
    let author = req.body.creator;
    db.run('INSERT INTO shared(sheetID,email) VALUES(?,?)', [sheetID, strValues], function (err, row) {
        if (!err) {
            res.send({ ok: "success" });
        } else {
            res.send({ err: err });
        }
    });

});

app.get('/allUsers', authenticator, (req, res) => {
    db.all('SELECT email FROM user', [], function (err, rows) {
        if (!err) {
            res.send({ ok: true, users: rows })
        } else {
            res.send({ ok: false });
        }
    });
});


app.get('/chart',authenticator,jsonParser,(req,res)=>{
    const id = req.query['name'];
    const chartType = req.query['chartType'];
    console.log("CHARTTYPE: ", chartType);
    const admin = req.session.admin;
    db.get(`SELECT title, data FROM sheet WHERE id=?`,[id],function(err,row){
        if(!err){
            if(row!= undefined){
                res.render('chart',{
                    sess: req.session,
                    data: row.data,
                    title: row.title,
                    chartType: chartType
                });
            }else{
                res.send('row is undefined');
            }
            
        }else{
            res.send({err:err});
        }
    });
})


app.listen(port, function () {
    console.log(`Listening on port ${port}!`);
});
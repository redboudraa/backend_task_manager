const express = require("express");
const app = express();
const bodyparser = require("body-parser");
const { mongoose } = require("./db/mongoose");
const { project } = require("./db/models/project.model");
const { task } = require("./db/models/task.model");
const { User } = require("./db/models/user.model");
const jwt = require("jsonwebtoken");

// Load middleware
app.use(bodyparser.json());
// CORS HEADERS MIDDLEWARE
app.use(function(req, res, next) {
  res.header("Access-Control-Allow-Origin", "*");
  res.header(
    "Access-Control-Allow-Methods",
    "GET, POST, HEAD, OPTIONS, PUT, PATCH, DELETE"
  );
  res.header(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept, x-access-token, x-refresh-token, _id"
  );

  res.header(
    "Access-Control-Expose-Headers",
    "x-access-token, x-refresh-token"
  );

  next();
});

// check whether the request has a valid JWT access token
let authenticate = (req, res, next) => {
  let token = req.header("x-access-token");

  // verify the JWT
  jwt.verify(token, User.getJWTSecret(), (err, decoded) => {
    if (err) {
      // there was an error
      // jwt is invalid - * DO NOT AUTHENTICATE *
      res.status(401).send(err);
    } else {
      // jwt is valid
      req.user_id = decoded._id;
      next();
    }
  });
};

// Verify Refresh Token Middleware (which will be verifying the session)
let verifySession = (req, res, next) => {
  // grab the refresh token from the request header
  let refreshToken = req.header("x-refresh-token");

  // grab the _id from the request header
  let _id = req.header("_id");

  User.findByIdAndToken(_id, refreshToken)
    .then(user => {
      if (!user) {
        // user couldn't be found
        return Promise.reject({
          error:
            "User not found. Make sure that the refresh token and user id are correct"
        });
      }

      // if the code reaches here - the user was found
      // therefore the refresh token exists in the database - but we still have to check if it has expired or not

      req.user_id = user._id;
      req.userObject = user;
      req.refreshToken = refreshToken;

      let isSessionValid = false;

      user.sessions.forEach(session => {
        if (session.token === refreshToken) {
          // check if the session has expired
          if (User.hasRefreshTokenExpired(session.expiresAt) === false) {
            // refresh token has not expired
            isSessionValid = true;
          }
        }
      });

      if (isSessionValid) {
        // the session is VALID - call next() to continue with processing this web request
        next();
      } else {
        // the session is not valid
        return Promise.reject({
          error: "Refresh token has expired or the session is invalid"
        });
      }
    })
    .catch(e => {
      res.status(401).send(e);
    });
};

/* END MIDDLEWARE  */

/**
 * Get all the projects
 * route:/project
 */
app.get("/project", authenticate, (req, res) => {
  project
    .find({ _userId: req.user_id })
    .then(lists => {
      res.send(lists);
    })
    .catch(e => {
      res.send(e);
    });
});

/**
 * create project
 * route:/project
 */
app.post("/project", authenticate, (req, res) => {
  let title = req.body.title;
  let user = req.user_id;
  let Newproject = new project({
    title,
    _userId: user
  });
  Newproject.save()
    .then(proj => {
      res.send(proj);
    })
    .catch(e => res.status(400).send(e));
});
/**
 * Get one specific
 * route:/project/id
 */
app.get("/project/:id", authenticate, (req, res) => {
  let user = req.user_id;

  project
    .find({ _id: req.params.id, _userId: user })
    .then(lists => {
      res.send(lists);
    })
    .catch(e => {
      res.send(e);
    });
});

/**
 * Delete a specific project by id
 * route /project/id
 */
app.delete("/project/:id", authenticate, (req, res) => {
  let user = req.user_id;

  project
    .findOneAndRemove({ _id: req.params.id, _userId: user })
    .then(lists => {
      res.send(lists);
      deleteTasksFromList(lists._id);
    })
    .catch(e => {
      res.send(e);
    });
});
/**
 * Update a project by id
 * route:/project/id
 */
app.patch("/project/:id", authenticate, (req, res) => {
  let user = req.user_id;

  project
    .findOneAndUpdate(
      { _id: req.params.id, _userId: user },
      {
        $set: req.body
      }
    )
    .then(() => {
      res.send({ message: "Updated successfully." });
    })
    .catch(e => {
      res.send(e);
    });
});

app.listen(3000, () => {
  console.log("server working on port 3000");
});

/**
 * Get all the tasks for specific project
 * route:/project/id/task
 */
app.get("/project/:id/task", authenticate, (req, res) => {
  project.findOne({ _id: req.params.id, _userId: req.user_id }).then(proj => {
    if (proj) {
      task
        .find({
          _projectid: req.params.id
        })
        .then(tasks => {
          res.send(tasks);
        })
        .catch(e => {
          res.status(400).send(e);
        });
    } else {
      res.sendStatus(404);
    }
  });
});
/**
 * Create task related to a proejct
 * rotue:/project/id/task
 */
app.post("/project/:id/task", authenticate, (req, res) => {
  project.findOne({ _id: req.params.id, _userId: req.user_id }).then(proj => {
    if (proj) {
      let title = req.body.title;
      let _projectid = req.params.id;
      let Newtask = new task({
        title: title,
        _projectid: _projectid
      });
      Newtask.save()
        .then(task => {
          res.send(task);
        })
        .catch(e => res.status(400).send(e));
    } else {
      res.sendStatus(404);
    }
  });
});
/**
 * Delete a task
 * route:/project/task/id
 */
app.delete("/project/:pid/task/:id", authenticate, (req, res) => {
  project.findOne({ _id: req.params.pid, _userId: req.user_id }).then(proj => {
    if (proj) {
      task
        .findByIdAndDelete(req.params.id)
        .then(lists => {
          res.send(lists);
        })
        .catch(e => {
          res.send(e);
        });
    } else {
      res.sendStatus(404);
    }
  });
});
/**
 * Update a task by id
 * route:/project/task/id
 */
app.patch("/project/:pid/task/:id", authenticate, (req, res) => {
  project.findOne({ _id: req.params.pid, _userId: req.user_id }).then(proj => {
    if (proj) {
      task
        .findOneAndUpdate(
          { _id: req.params.id, _projectid: req.params.pid },
          {
            $set: req.body
          }
        )
        .then(task => {
          res.send(task);
          console.log("updating");
        })
        .catch(e => {
          res.send(e);
        });
    } else {
      res.sendStatus(404);
    }
  });
});

/* HELPER METHODS */
let deleteTasksFromList = _projectid => {
  task
    .deleteMany({
      _projectid
    })
    .then(() => {
      console.log("Tasks from " + _projectid + " were deleted!");
    });
};

/* USER ROUTES */

/**
 * POST /users
 * Purpose: Sign up
 */
app.post("/users", (req, res) => {
  // User sign up

  let body = req.body;
  let newUser = new User(body);

  newUser
    .save()
    .then(() => {
      return newUser.createSession();
    })
    .then(refreshToken => {
      // Session created successfully - refreshToken returned.
      // now we geneate an access auth token for the user

      return newUser.generateAccessAuthToken().then(accessToken => {
        // access auth token generated successfully, now we return an object containing the auth tokens
        return { accessToken, refreshToken };
      });
    })
    .then(authTokens => {
      // Now we construct and send the response to the user with their auth tokens in the header and the user object in the body
      res
        .header("x-refresh-token", authTokens.refreshToken)
        .header("x-access-token", authTokens.accessToken)
        .send(newUser);
    })
    .catch(e => {
      res.status(400).send(e);
    });
});
/**
 * GET /user
 * Purpose: Get the info about the authentifiated user
 */
app.get("/user", authenticate, (req, res) => {
  console.log(req.user_id);
  User.findById(req.user_id)
    .then(user => {
      res.send(user);
    })
    .catch(e => {
      res.status(400).send(e);
    });
});
/**
 * POST /users/login
 * Purpose: Login
 */
app.post("/users/login", (req, res) => {
  let email = req.body.email;
  let password = req.body.password;

  User.findByCredentials(email, password)
    .then(user => {
      return user
        .createSession()
        .then(refreshToken => {
          // Session created successfully - refreshToken returned.
          // now we geneate an access auth token for the user

          return user.generateAccessAuthToken().then(accessToken => {
            // access auth token generated successfully, now we return an object containing the auth tokens
            return { accessToken, refreshToken };
          });
        })
        .then(authTokens => {
          // Now we construct and send the response to the user with their auth tokens in the header and the user object in the body
          res
            .header("x-refresh-token", authTokens.refreshToken)
            .header("x-access-token", authTokens.accessToken)
            .send(user);
        });
    })
    .catch(e => {
      res.status(400).send(e);
    });
});

/**
 * GET /users/me/access-token
 * Purpose: generates and returns an access token
 */
app.get("/users/me/access-token", verifySession, (req, res) => {
  // we know that the user/caller is authenticated and we have the user_id and user object available to us
  req.userObject
    .generateAccessAuthToken()
    .then(accessToken => {
      res.header("x-access-token", accessToken).send({ accessToken });
    })
    .catch(e => {
      res.status(400).send(e);
    });
});

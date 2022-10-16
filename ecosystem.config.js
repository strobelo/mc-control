module.exports = {
  apps : [{
    name   : "mc-control",
    script : "./index.js"
  }],
  deploy : {
    production : {
       "user" : "ubuntu",
       "host" : ["43.206.115.79"],
       "ref"  : "origin/main",
       "repo" : "git@github.com:strobelo/mc-control.git",
       "path" : "/home/ubuntu/mc-control",
       "post-deploy" : "npm install && pm2 startOrRestart ecosystem.config.js --env production"
    }
  }
}

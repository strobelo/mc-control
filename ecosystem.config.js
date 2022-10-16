module.exports = {
  apps : [{
    name   : "mc-control",
    script : "./index.js"
  }],
  deploy : {
    production : {
       "user" : "ubuntu",
       "host" : ["192.168.0.13"],
       "ref"  : "origin/master",
       "repo" : "git@github.com:Username/repository.git",
       "path" : "/var/www/my-repository",
       "post-deploy" : "npm install"
    }
  }
}

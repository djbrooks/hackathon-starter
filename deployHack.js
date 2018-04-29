// deploy.js
//
// NOTICE!!!! Place script in directory ABOVE the project folder.
// Not IN the project folder...
//
// Execute this script from the directory it is contained. Your target
// project directory should be IN THE FOLDER THIS SCRIPT IS IN!
//

// TODO: Update these values to your EC2 instance values... 
var remoteHost= "54.201.164.52";
var remoteUsername= "ubuntu";
var repoName= "hackathon-starter";
var remotePrivateKey= "../hs-key.pem";

var cmd = require('node-cmd');
var fs = require('fs');
var path = require('path');
var node_ssh = require('node-ssh');
var ssh = new node_ssh();

// the method that starts the deployment process
function main() {
	console.log("Deployment started.");
    // NOPE! Don't clone anything. Too distructive. Geez...
    // Just jump straight to sshConnect();
	// cloneRepo();
	sshConnect();
}

// responsible for cloning the repo
function cloneRepo() {
	console.log("Cloning repo...");
	// delete old copy of repo. Then, clone a fresh copy of repo from GitHub
	cmd.get(
		'cd ~/repos; rm -rf ./hackathon-starter && git clone https://github.com/sahat/hackathon-starter.git',
		function(err, data, stderr){
			console.log("cloneRepo callback\n\t err: " + err + "\n\t data: " + data + "\n\t stderr: " + stderr);
			if(err == null){
			    console.log("No errors in cloneRepo. Trying sshConnect now...");
				sshConnect();
			}
        }
	);
}

// transfers local project to the remote server
function transferProjectToRemote(failed, successful) {
	return ssh.putDirectory(__dirname + '', '/home/ubuntu/hackathon-starter-temp', {
		recursive: true,
		concurrency: 1,
		validate: function(itemPath) {
			const baseName = path.basename(itemPath)
			return baseName.substr(0, 1) !== '.' // do not allow dot files
				&& baseName !== 'node_modules' // do not allow node_modules
				&& baseName !== 'deployHack.js' // this pgm
				&& baseName !== 'data' // do not allow data dir
		},
		tick: function(localPath, remotePath, error) {
			if (error) {
			failed.push(localPath)
			console.log("failed.push: " + localPath)
			} else {
			successful.push(localPath)
			console.log("successful.push: " + localPath)
			}
		}
	})
}

// creates a temporary folder on the remote server
function createRemoteTempFolder() {
    let crtftemp = repoName + "-temp";  
    let crtf = "rm -rf " + crtftemp + " && mkdir " + crtftemp;  
	//return ssh.execCommand('rm -rf hackathon-starter-temp && mkdir hackathon-starter-temp', { cwd:'/home/ubuntu' })
	return ssh.execCommand(crtf, { cwd:'/home/ubuntu' })
}

// stops mongodb and node services on the remote server
function stopRemoteServices() {
	return ssh.execCommand('npm stop && sudo service mongod stop', { cwd:'/home/ubuntu/hackathon-starter' })
	//return ssh.execCommand('cd hackathon-starter && npm stop && sudo service mongod stop', { cwd:'/home/ubuntu'}).then(function(result) {
    //console.log('STDOUT: ' + result.stdout)
    //console.log('STDERR: ' + result.stderr)
//})
}

// updates the project on the server
function updateRemoteApp() {
	return ssh.execCommand('cp -r hackathon-starter-temp/* hackathon-starter/ && rm -rf hackathon-starter-temp/*', { cwd:'/home/ubuntu' })
}

// restart mongodb and node services on the remote server
function restartRemoteServices() {
	return ssh.execCommand('npm start && sudo service mongod start', { cwd:'/home/ubuntu' })
}

// connect to the remote server
function sshConnect() {
	console.log("Connecting to " + remoteHost + " as " + remoteUsername + "...");
	ssh.connect({
		// TODO: ADD YOUR IP ADDRESS BELOW (e.g. '12.34.5.67')
		host: remoteHost,
		username: remoteUsername,
		privateKey: remotePrivateKey
	})
	.then(function() {
		console.log("SSH Connection established.");

		// Create "hackathon-starter-temp" directory on remote server
		console.log("Creating `hackathon-starter-temp` folder on remote host.");

		return createRemoteTempFolder();
	})
	.then(function(result) {
        console.log("after createRemoteTempFolder result object is ", result);
		const failed = []
		const successful = []
		if(result.stdout){ console.log('STDOUT: ' + result.stdout); }
		if(result.stderr){
			console.log('STDERR: ' + result.stderr);
			return Promise.reject(result.stderr);
		}
		return transferProjectToRemote(failed, successful);
	})
	.then(function(status) {
        console.log("after transferProjectToRemote Status is: ", status);
		if (status) {
			return stopRemoteServices();
		} else {
			return Promise.reject(failed.join(', '));
		}
	})
	.then(function(status) {
        console.log("after stopRemoteServices Status is: ", status);
		if (status) {
			return updateRemoteApp();
		} else {
			return Promise.reject(failed.join(', '));
		}
	})
	.then(function(status) {
        console.log("after updateRemoteApp Status is: ", status);
		if (status) {
			return restartRemoteServices();
		} else {
			return Promise.reject(failed.join(', '));
		}
	})
	.then(function() {
        console.log("after restartRemoteServices Status is: ", status);
		console.log("Deployment complete.");
		process.exit(0);
	})
	.catch(e => {
		console.error(e);
		process.exit(1);
	})
}

main();


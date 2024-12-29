# online-shooter
This game is a recreation of diep.io that I made for my own learning experience. It features fully-functioning multiplayer, although you must be on the same network as the server in order to connect (it is essentially a LAN game).

In order to run a server, you must install [Node.js](https://nodejs.org/en/download/) (you must ensure npm is included in the installation). Then, download this repository (make sure to unzip it), open a terminal, and navigate to the newly downloaded repository.

For example, if the online-shooter folder is located in your downloads, do the following:
```shell
cd Downloads/online-shooter-main
```

Then, you must install express:
```shell
npm install express
```

Then, to run the server, use the command:
```shell
node backend/server.mjs
```
<br/>
Now that you have an instance of a server running on your local machine, you can connect to the server as a client by opening web browser, and typing in the IP address of the server, followed by a colon, and then the port the server is hosted on.

For example, if you wish to connect as a client on the same machine that the server is hosted on, type this into the address bar:
```shell
localhost:3000
```
(localhost is shorthand for the IP address of the machine you are using)

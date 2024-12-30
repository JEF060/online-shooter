# online-shooter
This game is a recreation/clone of diep.io that I made for my own learning experience. I intend to add features to differentiate my game from its predecessor, but at the moment it is very basic. It features fully-functioning multiplayer, and is meant to be played with other people.

Someday I may purchase a domain and a web server so that you can play with anyone across the world by simply going to some website, instead of needing to set up your own server than only extends across your local network. Doing that would cost some money, though.

## Setting Up a Server
In order to play the game, there must be a server running somewhere that you can connect to. If you already have a server set up and running, then go down to the *Connecting as a Client* section. Otherwise, these steps will walk you through how to set up a server on your local network, which can only be accessed by other machines also on your local network (unless you were to implement something such as *port forwarding*, which is far beyond the scope of this guide).

### Installing Node.js
To run a server, you must have Node.js installed. This only needs to be done a single time; If you download later versions in the future, you can skip this section and move on to *Installing Game Files*. These are the steps to install Node.js:

 1. Go here: [Node.js](https://nodejs.org/en/download/)
 2. Near the bottom, click the green button: "**Windows Installer (.msi)**" to download the Node.js installer.
 3. After the installer finishes downloading, navigate to your downloads folder and run the installer.
 4. As you progress through the Node.js Setup, you likely will not need to change anything. However, ensure that "**npm package manager**" and "**Add to PATH**" are set to "Will be installed on local hard drive".
 5. Click "Install" and wait for it to finish (you can get rid of the installer afterwards).

### Installing Game Files
In order to run a server, you must download this repository. Also, when an updated version of the game is released, you will need to re-download the game files in order to run an updated version of the server. Here are the steps:

 1. Near the top-right of this Github repository, click the green "**Code**" button to bring up a dropdown menu.
 2. At the bottom of the menu, click "**Download ZIP**" and wait for it to finish downloading.
 3. Navigate to the newly downloaded zipped folder and open it. There should be a single, unzipped folder inside with the same name as the zipped folder, which is **online-shooter-main**.
 4. Click and drag this folder to copy it somewhere outside of the zipped folder, such as your *Downloads* or *Documents* folder (you may want to open a new File Explorer window with the destination open in order to make clicking-and-dragging easier).
 5. You can now delete the original, zipped folder.

### Installing Express
This needs to be done every time that you download a new version of the game files. Here are the steps:

 1. Open a terminal. On windows, you can use the search bar on the bottom-left of your screen to find and open *Command Prompt*.
 2. You should see something like `C:\Users\your_username>` followed by a blinking box.
 3. Navigate to the **online-shooter-main** folder using the *cd* (change directory) command.
 4. For example, if you placed the folder in downloads, you would type `cd Downloads/online-shooter-main` (make sure to use a forward slash), press enter, and then your terminal would now read `C:\Users\your_username\Downloads\online-shooter-main>`.
 5. Once you are in the "online-shooter-main" folder, type the command `npm install express` and press enter.
 6. As long as the terminal didn't give you any errors, you've completed this step. Don't close the terminal yet.

### Running the Server
Now that you have finished installing Node.js, the game files, and express, you are ready to actually run the server. Open a terminal window, navigate to the **online-shooter-main** folder, and run the following command (you can reuse the same terminal from the previous step if you still have it open):
```shell
node backend/server.mjs
```
If the terminal outputs the following message, then that means you're good to go and clients can now connect and play the game.
```shell
-----------------------
| Server Initializing |
-----------------------

listening on port 3000
```
To stop the server, simply close the terminal window. If you want to start the server again, simply open a new terminal window, navigate to the "online-shooter-main" folder, and run the command at the start of this section.

## Connecting as a Client
Once there is a server running somewhere that your device can access, such as on another device in your home network, you can join the game and start playing. This process is much quicker than setting up a server.

 1. Open a web browser, such as Google.
 2. In the address bar, type the **IPv4** address of the machine hosting the server (don't press enter yet). Your IPv4 address can be found by going to [whatismyipaddress.com](https://whatismyipaddress.com/) (Tip: if you are connecting to the server on the same machine the server is running on, you can simply type *localhost* in place of your IP address, because *localhost* is shorthand for the IP address of the machine it is used on).
 3. Type a colon (:), followed by **3000** (this is the port number the server is listening on, and is given to you in the terminal when you initiated the server).
 4. You should have typed something like **#.#.#.#:3000** or **localhost:3000**. Press enter, and you should connect to the game.

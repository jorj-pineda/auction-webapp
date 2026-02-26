# Tostan Art Auction Webapp

A full-stack, real-time auction platform built for the **Austin College Service Station** to facilitate their annual charity event benefiting [Tostan](https://tostan.org/).

Any questions refer to Jorge at jorgepineda0310@gmail.com
The purpose of this webapp is to assist the Austin College Service Station in allowing our art auction to be digitized in a secure and realiable way that minimizes the issues seen when using paper for bids. 


**Impact:** Successfully handled 160+ live attendees, 130+ art pieces, and raised over $700 for charity with 0 downtime.

## Features

* **Real-Time Bidding:** Instant bid updates with concurrency protection against race conditions.
* **Live Dashboard:** Admin panel with real-time stats (Money Raised, Active Bidders, Total Bids).
* **Item Placement:** Admin ability to input items through admin panel.
* **Notification:** Email notif sent to user everytime they are outbid to promote competitiveness. 
* **Lazy Loading:** Optimized grid view handling 130+ high-res images with sub-200ms load times.
* **Anti-troll:** Smart tier-based bidding logic and rational minimum and maximum bids
* **Email Automation:** Throttled SMTP queue to send winner notifications without triggering spam filters.
* **Security:** Email domain restriction (`@austincollege.edu`) and environment variable protection.

## Tech Stack

* **Backend:** Node.js, Express.js
* **Database:** SQLite3 (Serialized for transaction safety)
* **Frontend:** EJS Templating, Tailwind CSS
* **Infrastructure:** Self-hosted via ngrok tunnel


<img width="1919" height="429" alt="image" src="https://github.com/user-attachments/assets/ea16a053-289a-40b8-8343-7c23ffe2fdf9" />



## Installation & Setup

### Instructions

The following are instructions for the following **workgroups in the Service Station** to get this website running form their computer.

It will be in laymans terms for them to easily get this on their box. 

The website is run via ngrok that creates a public, secure website for our purposes. Buy the $10 version week before event to run Tostan traffic.
This runs the server on your laptop, thus it will need to stay on the duration of the auction, and anytime you want the website live.

## Things you will need to install:

VScode: https://code.visualstudio.com/download
Ngrok: https://ngrok.com/download/windows (might need to change for mac)
Node.js: https://nodejs.org/en/download
git: https://git-scm.com/install/


## Accounts you will need to make:

github
ngrok

Make a folder on your desktop called Tostan. Then right click the folder and click open in Terminal

<img width="345" height="391" alt="image" src="https://github.com/user-attachments/assets/4669906a-c29c-4f38-96d5-ccfaaa7fdd3b" />

Once you are in the terminal, type

git clone https://github.com/jorj-pineda/auction-webapp.git

Which should clone the repo into your computer. 

Then open VScode and open the auction-webapp folder.

Once you open the folder, from the email you send me for the .env file (the file that has all the secure stuff), add the .env file into that auction-webapp folder.

Now open a notepad.
When you made an ngrok acc, you should see a "Your Authtoken"
Go into that, click show authtoken, and paste that into your notepad.
You will also create a domain from ngrok, name it what you like.
You will paste that link into the .env file where it says "BASE_URL:thisurl.wtv"
You will also paste that link into your notepad (for easier access). 

<img width="1714" height="530" alt="image" src="https://github.com/user-attachments/assets/4bbd9104-2d88-4f27-9d6b-8dd7e94c269f" />

## How to run the website

Open ngrok on your laptop, it should open something that looks like the terminal you opened earlier.
Paste the auth token, click enter
Paste the link from ngrok domain 

Then go back into VSCode
Once you have all the code in VScode, on the top you will open a terminal. 

<img width="784" height="633" alt="image" src="https://github.com/user-attachments/assets/d451303b-1f90-4d7a-8866-b00b57934e6a" />


In the terminal type:

node server.js

Under that *should* be a link that takes you to the website to be able to open it. 

<img width="1918" height="683" alt="image" src="https://github.com/user-attachments/assets/3fdd5d1a-bcf3-4799-ad55-8bf6a150ca35" />


## Admin page

To go to the admin page, just type /admin to the end of the link and put the password (from .env). 


<img width="1916" height="791" alt="image" src="https://github.com/user-attachments/assets/6c2b6d1a-a818-4228-8b9b-d3dafa22e15e" />


From here you can both add, delete, edit items. You will NEED to compress the photos before putting them in or else this will be a very expensive website. 
Use https://squoosh.app/ to be able to compress images.

You will see placement order, title, etc. I'm sure you can figure that out. 


<img width="1519" height="813" alt="image" src="https://github.com/user-attachments/assets/851c10c9-6999-4aa4-9c8e-3cfb4529aeb0" />



Admin page password is also in the .env file

Make sure Sophia, Maya AND **I** approve it before the day of. Just to make sure everything works correctly. 

You know where to reach me. Good luck.


## License
This project is open-source and available under the [MIT License](LICENSE).

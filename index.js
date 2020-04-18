const express = require("express");
const bodyParser = require("body-parser");
const app = express();
const Discord = require('discord.js');
const Octokit = require("@octokit/rest");
const config = require('./config.json');
const api = require("twitch-api-v5");
const CronJob = require("cron").CronJob;

app.use(bodyParser.json()); // support json encoded bodies
app.use(bodyParser.urlencoded({ extended: true })); // support encoded bodies

api.clientID = "buemxzzsq0n2ttyfsyo080npaax118";

const client = new Discord.Client();
const octokit = new Octokit({
  auth: config.githubToken,
});

let streamsOnLive = [];

const searchStreams = () => {
  console.log('Lancement de la recherche de stream...');
  let offset = 0;
  let newStream = 0;
  let currentStream = 0;
  let streamEnd = 0;

  api.streams.live({ game: "Grand Theft Auto V", language: "fr", stream_type: "live", offset }, async (err, res) => {
    if(err) {
      console.log(err);
    } else {
      const firstCall = res;
      const maxOffset = Math.floor(firstCall._total / 25);
      const streams = firstCall.streams;

      if (maxOffset > 0) {
        offset++;
        while (offset < maxOffset) {
          const test = await new Promise((resolve) => {
              api.streams.live({ game: "Grand Theft Auto V", language: "fr", stream_type: "live", offset }, (err, res2) => {
              if (err) {
                console.log(err);
                resolve([]);
              }
              else {
                resolve(res2.streams);
              }
            })
          });
          streams.push(...test);
          offset++;
        }
      }

      const filterStreams = streams.filter(stream => stream.channel.status.toLowerCase().includes('ventura')).reduce((acc, item) => {
        if (!acc.some(elmt => elmt.channel.url === item.channel.url)) return [...acc, item];
        return acc;
      }, []);

      filterStreams.forEach(async stream => {
        currentStream++;
        if (!streamsOnLive.some(elmt => elmt.url === stream.channel.url)) {
          const channel = client.channels.find('name', 'test');
          const test = await channel.send(`Hey, y'a lui il stream ${stream.channel.url}`);
          streamsOnLive.push({ url: stream.channel.url, message: test });
          newStream++;
        }
      })

      streamsOnLive.forEach(elmt => {
        if (!filterStreams.some(stream => stream.channel.url === elmt.url)) {
          streamsOnLive.find(elmt2 => elmt2.url === elmt.url).message.delete();
          streamsOnLive = streamsOnLive.filter(elmt => elmt.url !== elmt.url);
          streamEnd++;
        }
      })

      console.log("Recherche terminée.");
      console.log(`${currentStream} streams en cours dont ${newStream} streams démarrés`);
      console.log(`${streamEnd} streams terminés`);
    }
  })
}

client.on('ready', () => {
  console.log('Connecté au Discord!');

  // new CronJob("*/2 * * * *", searchStreams).start();

  // new CronJob("*/1 * * * *", () => {
  //   const seb = client.users.find("discriminator", "2792");
  //   console.log(seb);
  //   seb.sendMessage("T'as cru t'étais qui?");
  // }).start();


  setInterval(function () {
    client.user.setPresence({
      game: {
        name: `${client.users.size} SuperFive'Fan`,
        type: "WATCHING",
      }
    });
  }, 10000);

  client.user.setStatus('available')
});

client.on('message', async msg => {
  if (msg.content.includes('!mochemk')) {
    const channel = client.channels.cache.find((test) => test.name === msg.channel.name);
    channel.send({ files: ['./boutonvert.png'] });
  }
  else if (msg.content.includes('!issue')) {
    if (msg.channel.name.toLowerCase() !== config.issueChannelName.toLowerCase()) return;

    const args = msg.content.split('"');

    const title = `${args[1]}`;
    const body = args[3];

    octokit.issues.create({
      owner: config.usernameGithub,
      repo: config.repoGithub,
      title,
      body: `<h3>Ouvert par ${msg.author.username}</h3><br/>${body}`,
    }).then(() => {
      msg.reply('Une issue a bien été créé.');
    }).catch((err) => {
      msg.reply("C'est cassé, contact un dev (Genre Sumsun le BG) !");
      console.log('ERROR', err);
    })
  }
  // else if (msg.content.includes('!nico')) {
  //   const channel = client.channels.find('name', msg.channel.name);
  //   const nico = client.users.find('discriminator', '0001');
  //   channel.send(nico, { files: ['./blobfish2.jpg'] });
  // }
  else if (msg.content.includes('!dés')) {
    const args = msg.content.split(' ');
    const numberOfDice = parseInt(args[1]) || 1;

    if (numberOfDice > 195) {
      msg.reply("https://www.youtube.com/watch?v=fAlyj6Hcz3E");
      return;
    }

    const stringNumber = [
      ':one:',
      ':two:',
      ':three:',
      ':four:',
      ':five:',
      ':six:'
    ]

    const isDev = msg.member.roles.cache.some(({ name }) => name.toLowerCase() === 'dev');

    if (numberOfDice && numberOfDice > 0) {
      let text = "Resultat: ";
      let total = 0;

      for (let i = 0; i < numberOfDice; i++) {
        const random = isDev ? 6 : Math.floor(Math.random() * 6) + 1;
        total += random;
        if (i !== numberOfDice - 1) {
          text += `${stringNumber[random - 1]} + `;
        }
        else if (i === numberOfDice - 1) {
          text += `${stringNumber[random - 1]}`;

          if (numberOfDice > 1) {
            text += ` = ${total}`;
          }
        }
      }

      msg.reply(text)
    }
  }
});

client.login(config.botDiscordToken);

app.post("/check", function (req, res) {
  const { username } = req.body;

  if (!username) {
    res.send('Invalid params');
    return;
  }

  const exist = client.users.cache.find(user => user.username === username) ? true : false;

  res.send({
    exist,
  });
});

app.post("/message", function (req, res) {
  const { username, state } = req.body;

  if (!username || !state) {
    res.send('Invalid params');
    return;
  }

  const user = client.users.cache.find(user => user.username === username);

  if (user) {
    let color;
    let message;
    let gif;

    switch(state) {
      case 'WHITELIST_GOOD': {
        color = "#00FF00";
        gif = "https://media.giphy.com/media/l1J9xV815LOOTUju0/giphy.gif";
        message = [
          `Salutations ${username},`,
          '',
          "tu viens d’être accepté sur la whitelist de FiveRP.",
          "Tu peux dès à présent te connecter sur le teamspeak (avec le plugin) et rejoindre le serveur.",
          '',
          "Amuses toi bien.",
        ];
        break;
      }
      case 'WHITELIST_PROGRESS': {
        color = "#FFD601";
        gif = "https://media.giphy.com/media/Hovfs6SeMERMc/giphy.gif";
        message = [
          `Salutations ${username},`,
          '',
          "nous avons bien reçus ta candidature pour rejoindre la whitelist de FiveRP. Nous corrigeons en général sous 48h les QCM, inutile de t'inquiéter tu recevras un message privée lorsque la correction sera effectué.",
          '',
          'À bientôt !',
        ];
        break;
      }
      case 'WHITELIST_BAD': {
        color = "#FF0000";
        gif = "https://media.giphy.com/media/y65VoOlimZaus/giphy.gif";
        message = [
          `Salutations ${username},`,
          '',
          "malheureusement tu as échoué lors d’une étape de la whitelist, nous t’invitons à retenter ta chance.",
          '',
          'À la prochaine.'
        ];
        break;
      }
      case 'WHITELIST_WAIT_VOCAL': {
        color = "#FFD601";
        gif = "https://media.giphy.com/media/9PnP3QnWhxI6lMiYWY/giphy.gif";
        message = [
          `Salutations ${username},`,
          '',
          "tu as réussi ton QCM et tu es désormais en attente d'entretien oral.",
          "Tu trouveras des salons sur discord afin d’effectuer cet entretiens, l’heure est variable et le jour aussi mais en général c’est un jour sur deux vers la fin de journée.",
          '',
          "Bonne chance à toi.",
        ];
        break;
      }
      case 'WHITELIST_SECOND': {
        color = "#FF0000";
        gif = "https://media.giphy.com/media/xUn3BWwJsCgIkLi8Ba/giphy.gif";
        message = [
          `Salutations ${username},`,
          '',
          "tu as échoué à ton premier essai mais tu bénéficies d’une deuxième chance.",
          '',
          'Allez, on se motive !'
        ];
        break;
      }
    }

    if (!message) {
      res.send("Invalid state param");
      return;
    }

    let embed = new Discord.MessageEmbed()
      .setColor(color)
      .setTitle("Whitelist FiveRP")
      .setThumbnail("https://i.gyazo.com/334ed3ed08f0315d7eb8a08a3937a435.png")
      .setDescription(message)
      .setTimestamp()
      .setFooter("L'équipe de FiveRP");
      // .addField("Inline field title", "Some value here", true);
    
    let embed2 = new Discord.MessageEmbed()
      .setColor(color)
      .setImage(gif);

    user.send(embed);
    user.send(embed2);
  }

  res.send(user ? 'Message sended' : 'Message failed');
});

app.listen(3000);
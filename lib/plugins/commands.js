const Utils = require('../utils')
function inject (bot) {
  bot.master = null
  bot.playerList = []
  bot.follow = false

  bot._client.on('D2GS_GAMECHAT', ({ charName, message }) => {
    if (message === '.master') {
      if (bot.master === null) {
        bot.say(`${charName} is now master`)
        try {
          bot.master = { id: bot.playerList.find(player => { return player.name === charName }).id, name: charName }
          bot._client.write('D2GS_PARTY', {
            actionId: 6, // TODO: what is it ? 6 invite, 7 cancel ?
            playerId: bot.playerList.find(player => { return player.name === charName }).id
          })
        } catch (error) {
          console.log(error)
          bot.say(`I don't have his id !`)
        }
      } else {
        bot.say(`${bot.master} is already master`)
      }
    }

    if (bot.master !== null) { // Just a security
      if ((message === '.follow' || message === '.followpf' || message === '.followpftp') && charName === bot.master.name) {
        const doPf = message === '.followpf'
        const doPfTp = message === '.followpftp'
        // We seems to receive this when someone take a warp / portal
        // For portals
        /* received compressed packet D2GS_TOWNPORTALSTATE {"state":3,"areaId":83,"unitId":236}
            received compressed packet D2GS_PORTALOWNERSHIP {"ownerId":1,"ownerName":[99,104,101,97,112,0,0,0,22,37,2,236,0,0,0,124],"localId":236,"remoteId":235}
            received compressed packet D2GS_OBJECTSTATE {"unitType":2,"unitId":236,"unknown":3,"unitState":513}
            received compressed packet D2GS_GAMELOADING {}
            received compressed packet D2GS_TOWNPORTALSTATE {"state":3,"areaId":83,"unitId":236}
            */
        /*
          walking close to already opened portal
          received compressed packet D2GS_WORLDOBJECT {"objectType":2,"objectId":203,"objectUniqueCode":59,"x":5158,"y":5068,"state":2,"interactionCondition":83}
          received compressed packet D2GS_TOWNPORTALSTATE {"state":3,"areaId":83,"unitId":203}
          received compressed packet D2GS_PORTALOWNERSHIP {"ownerId":2,"ownerName":[99,104,101,97,112,0,0,0,22,39,2,203,0,0,0,124],"localId":203,"remoteId":202}
        */

        bot.follow = !bot.follow
        bot.say(bot.follow ? `Following  ${bot.master.name}` : `Stopped following  ${bot.master.name}`)

        if (!bot.follow) { // TODO: when turning follow off maybe make the bots to go to portal spot in master act (if in camp)
          bot._client.removeAllListeners('D2GS_PLAYERMOVE')
          bot._client.removeAllListeners('D2GS_PORTALOWNERSHIP')
          bot._client.removeAllListeners('D2GS_CHARTOOBJ')
        } else {
          bot._client.on('D2GS_PLAYERMOVE', ({ targetX, targetY, unitId }) => {
            if (unitId === bot.master.id) {
              if (doPf) {
                bot.moveTo(false, targetX, targetY)
              } else if (doPfTp) {
                bot.moveTo(true, targetX, targetY)
              } else {
                bot.run(targetX, targetY) // Maybe use currentX, Y ? and runtoentity ?
              }
            }
          })
          // Master opens a portal
          bot._client.on('D2GS_PORTALOWNERSHIP', ({ ownerId, ownerName, localId, remoteId }) => { // TODO: Why is this looping ?
            // bot.say(`${Buffer.from(ownerName).toString().replace(/\0.*$/g, '')}:${ownerId}:masterId:${bot.master.id} opened a portal close to me`)
            // bot.say(bot.master.id === ownerId ? `He is my master, incoming` : `He isn't my master i stay here !`)
            if (bot.master.id === ownerId) {
              bot._client.write('D2GS_RUNTOENTITY', {
                entityType: 2,
                entityId: localId
              })
              bot._client.write('D2GS_INTERACTWITHENTITY', {
                entityType: 2,
                entityId: localId
              })
            }
          })
          // Master enter a warp
          bot._client.on('D2GS_CHARTOOBJ', ({ unknown, playerId, movementType, destinationType, objectId, x, y }) => {
            if (bot.master.id === playerId) {
              bot._client.write('D2GS_RUNTOENTITY', {
                entityType: destinationType,
                entityId: objectId
              })
              bot._client.write('D2GS_INTERACTWITHENTITY', {
                entityType: destinationType,
                entityId: objectId
              })
            }
          })
        }
      }

      if (message === '.autokill' && charName === bot.master.name) {
        bot.autokill = !bot.autokill
        bot.say(`Autokill  ${bot.autokill ? 'on' : 'off'}`)
        if (!bot.autokill) {
          bot._client.removeAllListeners('D2GS_NPCMOVE')
          bot._client.removeAllListeners('D2GS_NPCMOVETOTARGET')
          // bot.removeAllListeners('D2GS_NPCATTACK')
        } else {
          // Doesn't work if target too far
          bot._client.on('D2GS_NPCMOVE', ({ unitId, type, x, y }) => {
            if (Utils.distance({ x: bot.x, y: bot.y }, { x, y }) < 10) {
              bot.target = unitId
              // bot.run(x, y)
              // bot.castSkillOnEntity(type, unitId, 1)
              bot.castSkillOnLocation(x, y, 0)
            }
            // bot.castSkill(unitId, type, 49)
          })
          bot._client.on('D2GS_NPCMOVETOTARGET', ({ unitId, type, x, y }) => {
            if (Utils.distance({ x: bot.x, y: bot.y }, { x, y }) < 10) {
              // bot.run(x, y)
              // bot.castSkillOnEntity(type, unitId, 1)
              bot.castSkillOnLocation(x, y, 0)
            }
            // bot.castSkill(unitId, type, 49)
          })
          /*
          bot._client.on('D2GS_NPCATTACK', ({ x, y }) => {
            bot.castSkill(x, y, 49)
          })
          */
        }
      }

      if (message === '.findWarp' && charName === bot.master.name) {
        bot.findWarp(true)
      }

      if (message === '.pickup' && charName === bot.master.name) {
        bot.pickup = !bot.pickup
        bot.say(`pickup  ${bot.pickup ? 'on' : 'off'}`)
        if (!bot.pickup) {
          bot._client.removeAllListeners('D2GS_ITEMACTIONWORLD')
        } else {
          bot.pickupEveryItems()
        }
      }

      if (message.startsWith('.item') && charName === bot.master.name && message.split(' ').length > 1) {
        bot.hasItem(message.split(' ')[1])
      }

      if (message.startsWith('.pot') && charName === bot.master.name && message.split(' ').length > 1) {
        bot.dropPot(message.split(' ')[1] === 'hp')
      }

      if (message.startsWith('.wp') && charName === bot.master.name && message.split(' ').length > 1) {
        bot.takeWaypoint(parseInt(message.split(' ')[1]))
      }

      // Debug stuff
      if (message.startsWith('.write') && charName === bot.master.name && message.split(' ').length > 1) {
        try {
          bot._client.write(message.split(' ')[1])
        } catch (error) {
          console.log(error)
        }
      }

      if (message.startsWith('.do') && charName === bot.master.name && message.split(' ').length > 1) {
        switch (message.split(' ')[1]) {
          case '1':
            bot.moveToNextArea(true)
            break
          case '2':
            bot.runToWarp()
            break
          case '3':
            bot.moveTo(true, bot.npcs[0].x, bot.npcs[0].y)
            break
          case '4':
            bot.moveTo(false, bot.npcs[0].x, bot.npcs[0].y)
            break
          case '5':
            bot.moveTo(false, bot.x + parseInt(message.split(' ')[2]), bot.y + parseInt(message.split(' ')[3]))
            break
          case '55':
            bot.moveTo(true, bot.x + parseInt(message.split(' ')[2]), bot.y + parseInt(message.split(' ')[3]))
            break
          case '6': // come -> doesn't work from far away because position unknown
            bot._client.once('D2GS_PLAYERMOVE', ({ targetX, targetY, unitId }) => {
              if (unitId === bot.master.id) {
                bot.moveTo(false, targetX, targetY)
              }
            })
            break
          case '7':
            const npc = bot.npcs.find(npc => parseInt(npc['unitId']) === parseInt(message.split(' ')[2]))
            bot.moveTo(false, npc.x, npc.y)
            break
          case '8':
            const object = bot.objects.find(npc => parseInt(npc['objectId']) === parseInt(message.split(' ')[2]))
            bot.moveTo(false, object.x, object.y)
            break
          case '9': // come -> doesn't work from far away because position unknown
            bot._client.once('D2GS_PLAYERMOVE', ({ targetX, targetY, unitId }) => {
              if (unitId === bot.master.id) {
                bot.moveTo(true, targetX, targetY)
              }
            })
            break
          case '10':
            bot.say(`Space left in container ${message.split(' ')[2]}: ${bot.spaceLeft(parseInt(message.split(' ')[2]))}`)
            break
          case '11':
            bot.stash()
            break
          case '12':
            bot.checkTown()
            break
        }
      }

      if (message.startsWith('.move') && charName === bot.master.name && message.split(' ').length > 3) {
        bot.moveTo(message.split(' ')[1] === 'tp', bot.x + parseInt(message.split(' ')[2], 10), bot.y + parseInt(message.split(' ')[3], 10))
      }

      if (message.startsWith('.npc') && charName === bot.master.name && message.split(' ').length > 1) {
        if (bot.area === undefined) {
          return
        }
        switch (message.split(' ')[1]) {
          case 'heal':
            bot.reachNpc(bot.tasks[bot.area].heal)
            break
          case 'repair':
            bot.reachNpc(bot.tasks[bot.area].repair)
            break
          case 'gamble':
            bot.reachNpc(bot.tasks[bot.area].gamble)
            break
          case 'shop':
            bot.reachNpc(bot.tasks[bot.area].shop)
            break
        }
      }
    }
  })
}

module.exports = inject

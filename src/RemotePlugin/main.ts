import JsPlugin from '../lib/JsPlugin.js';
import ChatColor from '../lib/org/bukkit/ChatColor.js';
import CommandSender from '../lib/org/bukkit/command/CommandSender.js';
import Command from '../lib/org/bukkit/command/Command.js';
import Player from '../lib/org/bukkit/entity/Player.js';
import PlayerJoinEvent from '../lib/org/bukkit/event/player/PlayerJoinEvent.js';
import BlockRedstoneEvent from '../lib/org/bukkit/event/block/BlockRedstoneEvent.js';
import InventoryContents from '../lib/fr/minuskube/inv/content/InventoryContents.js';
import ItemStack from '../lib/org/bukkit/inventory/ItemStack.js';
import Material from '../lib/org/bukkit/Material.js';
import Enchantment from '../lib/org/bukkit/enchantments/Enchantment.js';
import ByteStreams from '../lib/com/google/common/io/ByteStreams.js';
import EntityType from '../lib/org/bukkit/entity/EntityType.js';
import Firework from '../lib/org/bukkit/entity/Firework.js';
import FireworkEffect from '../lib/org/bukkit/FireworkEffect.js';
import Color from '../lib/org/bukkit/Color.js';
import MysqlWrapper from '../lib/com/smc/utils/MysqlWrapper.js';
import CONFIG from './config.js'
import Sound from '../lib/org/bukkit/Sound.js';
import MinecraftVersions from '../lib/com/smc/version/MinecraftVersions.js';
import SmartInventory from '../lib/com/smc/smartinvs/SmartInventory.js';
import ItemBuilder from '../lib/com/smc/utils/ItemBuilder.js';
import SmartInventoryProvider from '../lib/com/smc/smartinvs/SmartInventoryProvider.js';
import Block from '../lib/org/bukkit/block/Block.js';
import AnaloguePowerable from '../lib/org/bukkit/block/data/AnaloguePowerable'
import Powerable from '../lib/org/bukkit/block/data/Powerable.js';
import Location from '../lib/org/bukkit/Location.js'
import FixedMetadataValue from '../lib/org/bukkit/metadata/FixedMetadataValue.js';
import Plugin from '../lib/org/bukkit/plugin/Plugin.js'
import ArmorStand from '../lib/org/bukkit/entity/ArmorStand.js'
import Bukkit from '../lib/org/bukkit/Bukkit.js';

function enumKeys<O extends object, K extends keyof O = keyof O>(obj: O): K[] {
    return Object.keys(obj).filter(k => Number.isNaN(+k)) as K[];
}

function ValidateIPaddress(ipaddress: string) {
    if (/^(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/.test(ipaddress)) {
        return true;
    }
    return false;
}

enum RemoteBlockType {
    REDSTONE = 0,
    COMMAND,
}

enum CommunicationType {
    SENDER = 0,
    RECEIVER,
}

class RemoteBlock {
    armorStand: ArmorStand = null;
    name: string;
    ip: string;
    port: Number;
    remoteBlockType: RemoteBlockType;
    communicationType: CommunicationType;
    block: Block;
    plugin: Plugin;

    constructor(name: string, block: Block, ip: string, port: Number, remoteBlockType: RemoteBlockType, communicationType: CommunicationType, plugin: Plugin) {
        this.setIp(ip);
        this.setPort(port);
        this.setRemoteBlockType(remoteBlockType);
        this.setCommunicationType(communicationType);

        this.block = block;
        this.plugin = plugin;

        this.setName(name);
    }

    compareLocation(loc: Location) {
        if (loc.distance(this.block.getLocation()) == 0) {
            return true;
        }
        return false;
    }

    getIp(): string {
        return this.ip;
    }

    getPort(): Number {
        return this.port;
    }

    getRemoteBlockType(): RemoteBlockType {
        return this.remoteBlockType;
    }

    getCommunicationType(): CommunicationType {
        return this.communicationType;
    }

    getName(): string {
        return this.name;
    }

    setIp(ip: string) {
        this.ip = ip;
    }

    setPort(port: Number) {
        this.port = port;;
    }

    setRemoteBlockType(type: RemoteBlockType) {
        this.remoteBlockType = type;
    }

    setCommunicationType(type: CommunicationType) {
        this.communicationType = type;
    }

    setName(name: string) {
        this.updateLabel(name);
        this.name = name;
    }

    updateLabel(label: string) {
        if (null == this.armorStand) {
            this.armorStand = <ArmorStand>this.block.getWorld().spawnEntity(this.block.getLocation().add(0.5, 0, 0.5), EntityType.ARMOR_STAND);
        }

        this.armorStand.setVisible(false);
        this.armorStand.setInvulnerable(true);
        this.armorStand.setGravity(false);
        this.armorStand.setSmall(true);
        this.armorStand.setCustomNameVisible(true);

        switch (this.getRemoteBlockType()) {
            case RemoteBlockType.REDSTONE: {
                console.log("redsonte");
                this.armorStand.setCustomName(ChatColor.RED + label);
                break;
            }
            case RemoteBlockType.COMMAND: {
                console.log("command");
                this.armorStand.setCustomName(ChatColor.GOLD + label);
                break;
            }
            default: {
                break;
            }
        }
    }

    deleteLabel() {
        if (null != this.armorStand) {
            this.armorStand.remove();
        }
    }
}

export default class RemotePlugin extends JsPlugin {
    httpPort = 8080;
    remoteBlocks = {};
    plugin: Plugin;

    onLoad() {
        console.log("[" + this.pluginName + "] onLoad()");
    }

    onEnable() {
        this.registerEvent(BlockRedstoneEvent, this.onBlockRedstoneEvent);

        let setConfigCmd = this.newCommand("remoteBlock-SetConfig");
        setConfigCmd.setExecutor(this.onSetConfigCmdExecute.bind(this));
        this.registerCommand(setConfigCmd);
        setConfigCmd.setTabCompleter(this.onTabCompleteSet.bind(this));

        let showConfigCmd = this.newCommand("remoteBlock-ShowConfig");
        showConfigCmd.setExecutor(this.onShowConfigCmdExecute.bind(this));
        this.registerCommand(showConfigCmd);
        showConfigCmd.setTabCompleter(this.onTabCompleteDeleteAndShow.bind(this));

        let deleteCmd = this.newCommand("remoteBlock-Delete");
        deleteCmd.setExecutor(this.onDeleteCmdExecute.bind(this));
        this.registerCommand(deleteCmd);
        deleteCmd.setTabCompleter(this.onTabCompleteDeleteAndShow.bind(this));

        this.plugin = this.server.getPluginManager().getPlugins()[0];
        
        // this.server.dispatchCommand(Bukkit.getConsoleSender(), "tell @a hi");

        console.log("done");
    }

    getRemoteBlockByLocation(loc: Location): RemoteBlock {
        for (let key in this.remoteBlocks) {
            let rb = this.remoteBlocks[key];
            if (rb.compareLocation(loc)) {
                return rb;
            }
        }

        return null;
    }

    getRemoteBlockByName(name: string): RemoteBlock {
        if (name in this.remoteBlocks) {
            return this.remoteBlocks[name];
        }

        return null;
    }

    onDisable() {

    }

    onBlockRedstoneEvent(blistener: any, event: BlockRedstoneEvent) {
        let block = event.getBlock();
    }

    onDeleteCmdExecute(sender: any, command: Command, label: string, args: Array<string>) {
        let remoteBlock: RemoteBlock = null;

        // args: x y z
        // args: name
        if (args.length == 3) {
            if ('getWorld' in sender) {
                let loc: Location = new Location(sender.getWorld(), parseFloat(args[0]), parseFloat(args[1]), parseFloat(args[2]));
                remoteBlock = this.getRemoteBlockByLocation(loc);
            }
        } else if (args.length == 1) {
            let name: string = args[0];
            remoteBlock = this.getRemoteBlockByName(name);
        } else {
            sender.sendMessage(ChatColor.RED + "Number of parameters is incorrect")
            return false;
        }

        if (remoteBlock) {
            if (remoteBlock.getRemoteBlockType() == RemoteBlockType.COMMAND) {
                if (!sender.isOp()) {
                    sender.sendMessage(ChatColor.RED + "Permission denied");
                    return false;
                }
            }

            delete this.remoteBlocks[remoteBlock.getName()];
            remoteBlock.deleteLabel();

            sender.sendMessage(ChatColor.GREEN + "Deleted remote block");
        } else {
            sender.sendMessage(ChatColor.RED + "Remote block doesn't exists with that name or location");
            return false;
        }

        return true;

    }

    onShowConfigCmdExecute(sender: any, command: Command, label: string, args: Array<string>) {
        let remoteBlock: RemoteBlock = null;

        // args: x y z
        // args: name
        if (args.length == 3) {
            if ('getWorld' in sender) {
                let loc: Location = new Location(sender.getWorld(), parseFloat(args[0]), parseFloat(args[1]), parseFloat(args[2]));
                remoteBlock = this.getRemoteBlockByLocation(loc);
            }
        } else if (args.length == 1) {
            let name: string = args[0];
            remoteBlock = this.getRemoteBlockByName(name);
        } else {
            sender.sendMessage(ChatColor.RED + "Number of parameters is incorrect");
            return false;
        }

        if (remoteBlock) {
            if (remoteBlock.getRemoteBlockType() == RemoteBlockType.COMMAND) {
                if (!sender.isOp()) {
                    sender.sendMessage(ChatColor.RED + "Permission denied");
                    return false;
                }
            }
            let remoteBlockData = { "Name": remoteBlock.getName(), "Ip": remoteBlock.getIp(), "Port": remoteBlock.getPort(), "RemoteBlockType": RemoteBlockType[remoteBlock.getRemoteBlockType()], "CommunicationType": CommunicationType[remoteBlock.getCommunicationType()] };
            sender.sendMessage(ChatColor.GREEN + JSON.stringify(remoteBlockData));
        } else {
            sender.sendMessage(ChatColor.RED + "Remote block doesn't exists with that name or location");
            return false;
        }

        return true;
    }

    onTabCompleteDeleteAndShow(sender: Player, command: Command, label: string, args: Array<string>): Array<string> {
        let result: Array<string> = [];

        switch (args.length) {
            case 1: {
                for (let key in this.remoteBlocks) {
                    result.push(key);
                }

                if (null == this.getRemoteBlockByLocation(sender.getTargetBlock(null, 50).getLocation())) {
                    result.push(sender.getTargetBlock(null, 50).getX().toString());
                }
                break;
            }
            case 2: {
                result.push(sender.getTargetBlock(null, 50).getY().toString());
                break;
            }
            case 3: {
                result.push(sender.getTargetBlock(null, 50).getZ().toString());
                break;
            }
            default: {
                break;
            }
        }

        return result;
    }

    checkSetConfigParameters(name: string, ip: string, port: Number, remoteBlockType: string, communicationType: string) {
        return (name.length > 0) && ValidateIPaddress(ip) && (port > 1000) && (remoteBlockType in RemoteBlockType) && (communicationType in CommunicationType);
    }

    onSetConfigCmdExecute(sender: any, command: Command, label: string, args: Array<string>) {
        let name: string = null;
        let ip: string = null;
        let port: Number = null;
        let block: Block = null;
        let remoteBlock: RemoteBlock = null;
        let remoteBlockType: string = null;
        let communicationType: string = null;

        // args: x y z name ip port remoteBlockType CommunicationType
        // args: name ip port remoteBlockType CommunicationType

        if (args.length == 8) {
            if ('getWorld' in sender) {
                let loc: Location = new Location(sender.getWorld(), parseFloat(args[0]), parseFloat(args[1]), parseFloat(args[2]));
                name = args[3];
                ip = args[4];
                port = parseInt(args[5]);
                remoteBlockType = args[6].toUpperCase();
                communicationType = args[7].toUpperCase();

                block = loc.getBlock();
                remoteBlock = this.getRemoteBlockByLocation(loc);
            }
        } else if (args.length == 5) {
            name = args[0];
            ip = args[1];
            port = parseInt(args[2]);
            remoteBlockType = args[3].toUpperCase();
            communicationType = args[4].toUpperCase();

            remoteBlock = this.getRemoteBlockByName(name);
        } else {
            sender.sendMessage(ChatColor.RED + "Number of parameters is incorrect");
            return false;
        }

        if (!this.checkSetConfigParameters(name, ip, port, remoteBlockType, communicationType)) {
            sender.sendMessage(ChatColor.RED + "Some of the parameters you entered are incorrect");
            return false;
        }

        if (null != remoteBlock) {
            console.log("exists");

            if (remoteBlock.getRemoteBlockType() == RemoteBlockType.COMMAND) {
                if (!sender.isOp()) {
                    sender.sendMessage(ChatColor.RED + "Permission denied");
                    return false;
                }
            }

            if (!(name in this.remoteBlocks)) {
                delete this.remoteBlocks[remoteBlock.name];
                this.remoteBlocks[name] = remoteBlock;
            }

            remoteBlock.setIp(ip);
            remoteBlock.setPort(port);
            remoteBlock.setRemoteBlockType(RemoteBlockType[remoteBlockType]);
            remoteBlock.setCommunicationType(CommunicationType[communicationType]);
            remoteBlock.setName(name);

            sender.sendMessage(ChatColor.GREEN + "Changed existing remote block");
        } else {
            if (block) {
                if (Material.REDSTONE_LAMP == block.getType()) {
                    console.log("new");

                    if (CommunicationType[communicationType] == RemoteBlockType.COMMAND) {
                        if (!sender.isOp()) {
                            sender.sendMessage(ChatColor.RED + "Permission denied");
                            return false;
                        }
                    }

                    if (null != this.getRemoteBlockByName(name)) {
                        sender.sendMessage(ChatColor.RED + "The name already exists in another remote block");
                        return false;
                    }

                    remoteBlock = new RemoteBlock(name, block, ip, port, RemoteBlockType[remoteBlockType], CommunicationType[communicationType], this.plugin);
                    this.remoteBlocks[name] = remoteBlock;

                    sender.sendMessage(ChatColor.GREEN + "Created new remote block");
                } else {
                    sender.sendMessage(ChatColor.RED + "Remote block can only be redstone lamp type");
                    return false;
                }
            } else {
                sender.sendMessage(ChatColor.RED + "Remote block by this name does not exist");
                return false;
            }
        }

        return true;

    }

    onTabCompleteSet(sender: Player, command: Command, label: string, args: Array<string>): Array<string> {
        let result: Array<string> = [];
        // args: x y z name ip port remoteBlockType CommunicationType
        // args: name ip port remoteBlockType CommunicationType

        switch (args.length) {
            case 1: {
                for (let key in this.remoteBlocks) {
                    result.push(key);
                }
                if ('getTargetBlock' in sender) {
                    if (null == this.getRemoteBlockByLocation(sender.getTargetBlock(null, 50).getLocation())) {
                        result.push(sender.getTargetBlock(null, 50).getX().toString());
                    }
                }
                break;
            }
            case 2: {
                if (args[0] in this.remoteBlocks) {
                    result.push("127.0.0.1");
                } else {
                    if ('getTargetBlock' in sender) {  
                        result.push(sender.getTargetBlock(null, 50).getY().toString());
                    }
                }
                break;
            }
            case 3: {
                if (args[0] in this.remoteBlocks) {
                    result.push(this.httpPort.toString());
                } else {
                    if ('getTargetBlock' in sender) {
                        result.push(sender.getTargetBlock(null, 50).getZ().toString());
                    }
                }
                break;
            }
            case 4: {
                if (args[0] in this.remoteBlocks) {
                    for (const value in enumKeys(RemoteBlockType)) {
                        result.push(RemoteBlockType[value]);
                    }
                }
                break;
            }
            case 5: {
                if (args[0] in this.remoteBlocks) {
                    for (const value in enumKeys(CommunicationType)) {
                        result.push(CommunicationType[value]);
                    }
                } else {
                    result.push("127.0.0.1");
                }
                break;
            }
            case 6: {
                if (!(args[0] in this.remoteBlocks)) {
                    result.push(this.httpPort.toString());
                }
                break;
            }
            case 7: {
                if (!(args[0] in this.remoteBlocks)) {
                    for (const value in enumKeys(RemoteBlockType)) {
                        result.push(RemoteBlockType[value]);
                    }
                }
                break;
            }
            case 8: {
                if (!(args[0] in this.remoteBlocks)) {
                    for (const value in enumKeys(CommunicationType)) {
                        result.push(CommunicationType[value]);
                    }
                }
                break;
            }
            default: {
                break;
            }
        }
        return result;
    }

}
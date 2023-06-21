const fork_ptr = Module.getExportByName(null, "fork");
const fork = new NativeFunction(fork_ptr, 'int', []);
Interceptor.replace(fork_ptr, new NativeCallback(function() {
    console.warn("Fork Found and Replaced");
    //return fork()
    return -1;
}, "int", []));

function ProcessName() {
    let openPtr = Module.getExportByName('libc.so', 'open');
    let open = new NativeFunction(openPtr, 'int', ['pointer', 'int']);
    let readPtr = Module.getExportByName('libc.so', 'read');
    let read = new NativeFunction(readPtr, 'int', ['int', 'pointer', 'int']);
    let closePtr = Module.getExportByName('libc.so', 'close');
    let close = new NativeFunction(closePtr, 'int', ['int']);
    let path = Memory.allocUtf8String('/proc/self/cmdline');
    let fd = open(path, 0);
    if (fd != -1) {
        let buffer = Memory.alloc(0x1000);
        let result = read(fd, buffer, 0x1000);
        close(fd);
        result = ptr(buffer).readCString();
        return result;
    }
    return -1;
}

function ProcessDex(Buf, C,Path) {
    let lvblanc = new Uint8Array(Buf);
    let Count = C - 1;
    if (lvblanc[0] == 99 && lvblanc[1] == 100 && lvblanc[2] == 101 && lvblanc[3] == 120 && lvblanc[4] == 48 && lvblanc[5] == 48 && lvblanc[6] == 49) {
        console.warn("[*]  classes" + Count + ".dex is CDex. Ignore It.");       
    } else
    if (lvblanc[0] == 0 && lvblanc[1] == 0 && lvblanc[2] == 0 && lvblanc[3] == 0 && lvblanc[4] == 0 && lvblanc[5] == 0 && lvblanc[6] == 0) {
        console.warn("[*] 0000000 Header. Probably classes" + Count + ".dex is Dexprotector's Dex.");
        console.error("[Dex"+Count +"] : "+Path);
        WriteDex(Count,Buf,Path,0);        
    } else
    if (lvblanc[0] == 0 || lvblanc[0] != 100) {
        console.warn("[*] Wiped Header , classes" + Count + ".dex is Interesting Dex.");
        console.error("[Dex"+Count +"] : "+Path);      
        WriteDex(Count,Buf,Path,0);
    } else {
        WriteDex(Count,Buf,Path,1);
    }
}
function WriteDex(Count,Buffer,Path,Flag) {   
   let DexFD = new File(Path, "wb");
   DexFD.write(Buffer)
   DexFD.flush();
   DexFD.close();
   if(Flag == 0){
      console.warn("[Dex"+Count +"] : "+Path);
   } else {
     console.log("[Dex"+Count +"] : "+Path);
   }
}

function Dump_Dex() {
    let Pro = ProcessName();
    let libart = Process.findModuleByName("libart.so");
    let addr_DefineClass = null;
    let symbols = libart.enumerateSymbols();
    for (let index = 0; index < symbols.length; index++) {
        let symbol = symbols[index];
        let symbol_name = symbol.name;
        if (symbol_name.indexOf("ClassLinker") >= 0 && symbol_name.indexOf("DefineClass") >= 0 && symbol_name.indexOf("Thread") >= 0 && symbol_name.indexOf("DexFile") >= 0) {
            addr_DefineClass = symbol.address;
            console.log("Dumping is running");
        }
    }
    let dex_maps = {};
    let dex_count = 1;
    if (addr_DefineClass) {
        Interceptor.attach(addr_DefineClass, {
            onEnter: function(args) {
                let dex_file = args[5];
                let base = ptr(dex_file).add(Process.pointerSize).readPointer();
                let size = ptr(dex_file).add(Process.pointerSize + Process.pointerSize).readUInt();
                if (dex_maps[base] == undefined) {
                    dex_maps[base] = size;
                    let dex_dir_path = "/data/data/" + Pro + "/";                                                        
                    let dex_path = dex_dir_path + "classes" + dex_count + ".dex";   
                    dex_count++;
                    let count_dex = dex_count;
                    let count = count_dex -1;
                    let dex_buffer = ptr(base).readByteArray(size);
                    ProcessDex(dex_buffer, dex_count,dex_path);
                }
            },
            onLeave: function(retval) {}
        });
    }
}
setImmediate(Dump_Dex);

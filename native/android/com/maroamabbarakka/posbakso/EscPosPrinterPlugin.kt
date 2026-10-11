package com.maroamabbarakka.posbakso

import android.Manifest
import android.bluetooth.BluetoothAdapter
import android.bluetooth.BluetoothDevice
import android.bluetooth.BluetoothSocket
import android.util.Base64
import com.getcapacitor.JSArray
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import com.getcapacitor.annotation.Permission
import java.io.OutputStream
import java.nio.charset.Charset
import java.util.UUID
import java.util.concurrent.Executors

@CapacitorPlugin(
    name = "EscPosPrinter",
    permissions = [
        Permission(strings = [Manifest.permission.BLUETOOTH_CONNECT], alias = "bluetoothConnect"),
        Permission(strings = [Manifest.permission.BLUETOOTH_SCAN], alias = "bluetoothScan")
    ]
)
class EscPosPrinterPlugin : Plugin() {
    private val sppUuid: UUID = UUID.fromString("00001101-0000-1000-8000-00805F9B34FB")
    private var socket: BluetoothSocket? = null
    private var output: OutputStream? = null
    private var charset: Charset = Charset.forName("CP437")
    private var codePage: Int = 0
    private var lastConnectedAddress: String? = null
    private val io = Executors.newSingleThreadExecutor()

    @PluginMethod fun getStatus(call: PluginCall) {
        val ret = JSObject(); ret.put("connected", socket?.isConnected == true); ret.put("device", socket?.remoteDevice?.name ?: ""); ret.put("address", socket?.remoteDevice?.address ?: ""); call.resolve(ret)
    }

    @PluginMethod fun scanPrinters(call: PluginCall) {
        val adapter = BluetoothAdapter.getDefaultAdapter() ?: run { call.reject("Bluetooth tidak tersedia"); return }
        try {
            val devices = JSArray(); adapter.bondedDevices.forEach { device -> val item = JSObject(); item.put("name", device.name ?: "Bluetooth Printer"); item.put("address", device.address); devices.put(item) }
            val ret = JSObject(); ret.put("devices", devices); call.resolve(ret)
        } catch (e: SecurityException) { call.reject("Izin Bluetooth belum diberikan", e) }
    }

    @PluginMethod fun connect(call: PluginCall) {
        val address = call.getString("address"); if (address.isNullOrBlank()) { call.reject("Alamat printer wajib diisi"); return }
        io.execute {
            try {
                disconnectInternal(); val adapter = BluetoothAdapter.getDefaultAdapter() ?: throw IllegalStateException("Bluetooth tidak tersedia")
                val device: BluetoothDevice = adapter.getRemoteDevice(address); val newSocket = device.createRfcommSocketToServiceRecord(sppUuid); newSocket.connect(); socket = newSocket; output = newSocket.outputStream
                lastConnectedAddress = address
                val ret = JSObject(); ret.put("connected", true); ret.put("name", device.name ?: "Printer"); ret.put("address", address); call.resolve(ret)
            } catch (e: Exception) { disconnectInternal(); call.reject("Gagal menghubungkan printer: ${e.message}", e) }
        }
    }

    @PluginMethod fun disconnect(call: PluginCall) { io.execute { disconnectInternal(); call.resolve() } }

    @PluginMethod fun testPrint(call: PluginCall) {
        val payload = call.getObject("payload") ?: JSObject()
        io.execute {
            try {
                ensureConnected(); configure(payload); resetPrinter();
                val raster = payload.getJSObject("logoRaster"); if (raster != null) { center(true); raster(raster); feed(1) }
                center(true); bold(true); text((payload.optString("brand", "BAKSO UMUM")).uppercase()+"\n"); bold(false); text("TEST PRINT / CALIBRATION\n")
                val width = width(payload); val dots=payload.optInt("printWidthDots",if(payload.optInt("paperWidth",80)==58)384 else 576)
                line('-', width); center(false); text(columns("Lebar Kertas", "${payload.optInt("paperWidth",80)} mm", width)+"\n"); text(columns("Print Head", "$dots dots", width)+"\n"); text(columns("Kolom Teks", "$width chars", width)+"\n"); text(columns("Codepage", payload.optString("characterSet","CP437"), width)+"\n"); text("Grafis: 1-bit ESC/POS GS v 0\n"); line('-',width)
                center(true); text("CALIBRATION RASTER / FULL WIDTH\n"); calibrationRaster(dots); text("|0%      25%      50%      75%     100%|\n"); text("Aa Bb Cc 1234567890\n"); text("Rp 25.000  -  Makassar\n"); feed(payload.optInt("feedLines",3)); if(payload.optBoolean("cutPaper",false)) cut(); call.resolve()
            } catch (e: Exception) { call.reject("Test print gagal: ${e.message}", e) }
        }
    }

    @PluginMethod fun printReceipt(call: PluginCall) {
        val payload = call.getObject("payload") ?: run { call.reject("Payload struk tidak tersedia"); return }
        io.execute { try { ensureConnected(); configure(payload); val copies=payload.optInt("copies",1).coerceIn(1,5); repeat(copies){ resetPrinter(); renderReceipt(payload, it == 0); if(it < copies-1) feed(2) }; call.resolve() } catch (e: Exception) { call.reject("Cetak struk gagal: ${e.message}", e) } }
    }

    @PluginMethod fun printKitchenTicket(call: PluginCall) {
        val payload = call.getObject("payload") ?: run { call.reject("Payload kitchen ticket tidak tersedia"); return }
        io.execute { try { ensureConnected(); configure(payload); val copies=payload.optInt("copies",1).coerceIn(1,5); repeat(copies){ resetPrinter(); renderKitchen(payload); if(it < copies-1) feed(2) }; call.resolve() } catch (e: Exception) { call.reject("Cetak dapur gagal: ${e.message}", e) } }
    }

    private fun configure(p:JSObject){
        val requested=p.optString("characterSet","CP437")
        charset = try { Charset.forName(requested) } catch(_:Exception){ Charset.forName("CP437") }
        // Common Epson-compatible ESC/POS table numbers. Some clones vary, so Test Print remains the calibration gate.
        codePage = when(requested.uppercase()) { "CP850" -> 2; "CP858" -> 19; "WINDOWS-1252", "CP1252" -> 16; else -> 0 }
    }
    private fun width(p:JSObject):Int { val dots=p.optInt("printWidthDots",if(p.optInt("paperWidth",80)==58)384 else 576); return (dots/12).coerceIn(24,48) }

    private fun renderReceipt(p: JSObject, allowDrawer:Boolean = true) {
        val header=p.getJSObject("header")?:JSObject(); val design=p.getJSObject("design")?:JSObject(); val order=p.getJSObject("order")?:JSObject(); val totals=p.getJSObject("totals")?:JSObject(); val payments=p.getJSONArray("payments")?:JSArray(); val items=p.getJSONArray("items")?:JSArray(); val width=width(p)
        val density=design.optString("density","normal"); if(density=="large") doubleWidth(true)
        val raster=p.getJSObject("logoRaster"); if(raster!=null&&design.optBoolean("showLogo",true)){align(design.optString("logoAlignment","center"));raster(raster);feed(1)}
        center(true);bold(true);val headerWidth=if(density=="large")(width/2).coerceAtLeast(12) else width;val title=design.optString("headerTitle",header.optString("brand","BAKSO UMUM"));if(title.isNotBlank())wrappedText(title.uppercase(),headerWidth);bold(false);val subtitle=design.optString("headerSubtitle","");if(subtitle.isNotBlank())wrappedText(subtitle,headerWidth)
        val headerLines=design.optJSONArray("headerLines");if(headerLines!=null)for(i in 0 until headerLines.length()){val line=headerLines.optString(i,"");if(line.isNotBlank())wrappedText(line,headerWidth)}
        if(design.optBoolean("showAddress",true)&&header.optString("address","").isNotBlank())wrappedText(header.optString("address",""),headerWidth)
        if(design.optBoolean("showPhone",true)&&header.optString("phone","").isNotBlank())wrappedText("Telp. ${header.optString("phone","")}",headerWidth)
        doubleWidth(false);line('-',width);val documentTitle=design.optString("documentTitle","NOTA PEMBELIAN");if(documentTitle.isNotBlank()){bold(true);center(true);wrappedText(documentTitle,width);bold(false)};line('-',width);center(false)
        text("No.     : ${order.optString("number","-")}\n");if(design.optBoolean("showQueueNumber",true))text("Antrean : ${order.optString("queueNumber","-")}\n")
        val created=order.optString("createdLabel",order.optString("createdAt",""));if(created.isNotBlank())text("Tanggal : $created\n")
        if(design.optBoolean("showCashier",true))text("Kasir   : ${order.optString("cashier","-")}\n")
        if(design.optBoolean("showOrderType",true)){val typeLabel=when(order.optString("type","")){"dine_in"->"Dine In";"takeaway"->"Bungkus";"delivery"->"Delivery";else->order.optString("type","-")};text("Order   : $typeLabel ${order.optString("tableName","")}\n")}
        val customer=order.optString("customerName","");if(design.optBoolean("showCustomer",true)&&customer.isNotBlank())text("Pelanggan: $customer\n");line('-',width)
        for(i in 0 until items.length()){
            val item=items.getJSONObject(i);val name=item.optString("name","Item");val qty=item.optInt("qty",1);val price=item.optLong("price",0);val total=item.optLong("total",0)
            val sku=item.optString("sku","");wrappedText(name+(if(design.optBoolean("showItemSku",false)&&sku.isNotBlank())" [$sku]" else ""),width);text(columns("$qty x ${money(price)}",money(total),width)+"\n")
            if(design.optBoolean("showModifiers",true)){val modifiers=item.optJSONArray("modifiers");if(modifiers!=null)for(j in 0 until modifiers.length()){val mod=modifiers.getJSONObject(j);val modName=mod.optString("name","");val modPrice=mod.optLong("price",0);if(modName.isNotBlank())wrappedText("  + $modName${if(modPrice>0)" (${money(modPrice)})" else ""}",width)}}
            val itemNote=item.optString("note","");if(design.optBoolean("showItemNotes",true)&&itemNote.isNotBlank())wrappedText("  Catatan: $itemNote",width)
        }
        val orderNote=order.optString("note","");if(design.optBoolean("showOrderNote",true)&&orderNote.isNotBlank()){line('.',width);wrappedText("Catatan: $orderNote",width)}
        line('-',width);text(columns("Subtotal",money(totals.optLong("subtotal",0)),width)+"\n");val discount=totals.optLong("discount",0);if(discount>0)text(columns("Diskon","-${money(discount)}",width)+"\n")
        if(design.optBoolean("showTaxBreakdown",true)){val tax=totals.optLong("tax",0);if(tax>0)text(columns("Pajak",money(tax),width)+"\n");val service=totals.optLong("service",0);if(service>0)text(columns("Service",money(service),width)+"\n")}
        bold(true);doubleWidth(true);text(columns("TOTAL","Rp${money(totals.optLong("total",0))}",width/2)+"\n");doubleWidth(false);bold(false);line('=',width)
        var totalChange=0L
        if(payments.length()>0){for(i in 0 until payments.length()){val pay=payments.getJSONObject(i);val label=pay.optString("label","Bayar");val paid=pay.optLong("tendered",pay.optLong("amount",0));text(columns(label,"Rp${money(paid)}",width)+"\n");if(design.optBoolean("showPaymentReference",true)){val ref=pay.optString("reference","");if(ref.isNotBlank())text("  Ref: $ref\n")};totalChange+=pay.optLong("change",0)}}
        if(totalChange>0)text(columns("Kembalian","Rp${money(totalChange)}",width)+"\n");line('-',width);center(true)
        val footerLines=design.optJSONArray("footerLines");if(footerLines!=null&&footerLines.length()>0){for(i in 0 until footerLines.length()){val footerLine=footerLines.optString(i,"");if(footerLine.isNotBlank())wrappedText(footerLine,width)}}
        if(design.optBoolean("showTagline",true)&&header.optString("tagline","").isNotBlank()){bold(true);wrappedText(header.optString("tagline",""),width);bold(false)}
        if(design.optBoolean("qrEnabled",false)){val value=design.optString("qrValue","");if(value.isNotBlank()){feed(1);qr(value,design.optInt("qrSize",6).coerceIn(3,10));val label=design.optString("qrLabel","");if(label.isNotBlank())wrappedText(label,width)}}
        if(design.optBoolean("barcodeEnabled",false)){val source=design.optString("barcodeSource","order_number");val value=if(source=="queue_number")order.optString("queueNumber","") else order.optString("number","");if(value.isNotBlank()){feed(1);barcodeCode128(value,design.optInt("barcodeHeight",72).coerceIn(40,120))}}
        feed(design.optInt("feedLines",4).coerceIn(1,10));if(allowDrawer&&p.optBoolean("openDrawer",false))drawer();if(p.optBoolean("cutPaper",false))cut()
    }

    private fun renderKitchen(p: JSObject) {
        val order=p.getJSObject("order")?:JSObject();val items=p.getJSONArray("items")?:JSArray();val width=width(p);center(true);bold(true);text((p.optString("stationLabel","ORDER DAPUR"))+"\n");doubleSize(true);text((order.optString("queueNumber","-"))+"\n");doubleSize(false);bold(false);line('=',width);center(false)
        val typeLabel=when(order.optString("type","")){"dine_in"->"DINE IN";"takeaway"->"BUNGKUS";"delivery"->"DELIVERY";else->order.optString("type","").uppercase()};text("$typeLabel  ${order.optString("tableName","")}\n");val customer=order.optString("customerName","");if(customer.isNotBlank())text("Pelanggan: $customer\n");line('-',width)
        for(i in 0 until items.length()){val item=items.getJSONObject(i);doubleSize(true);wrappedText("${item.optInt("qty",1)}x ${item.optString("name","Item")}",(width/2).coerceAtLeast(12));doubleSize(false);val modifiers=item.optJSONArray("modifiers");if(modifiers!=null)for(j in 0 until modifiers.length()){val mod=modifiers.getJSONObject(j);val name=mod.optString("name","");if(name.isNotBlank())wrappedText("   + $name",width)};val note=item.optString("note","");if(note.isNotBlank())wrappedText("   CATATAN: $note",width)}
        val note=order.optString("note","");if(note.isNotBlank()){line('-',width);wrappedText("CATATAN: $note",width)};line('=',width);wrappedText("Kasir: ${order.optString("cashier","-")}",width);feed((p.getJSObject("design")?:JSObject()).optInt("feedLines",4).coerceIn(1,10));if(p.optBoolean("cutPaper",false))cut()
    }

    private fun resetPrinter(){
        raw(byteArrayOf(0x1B,0x40)) // ESC @ : Initialize printer
        raw(byteArrayOf(0x1C,0x2E)) // FS . : Cancel Chinese character mode
        raw(byteArrayOf(0x1B,0x74,0x00)) // ESC t 0 : Code table CP437
    }

    private fun raster(obj:JSObject){
        val widthBytes=obj.optInt("widthBytes",0);val height=obj.optInt("height",0);val encoded=obj.optString("dataBase64","");if(widthBytes<=0||height<=0||encoded.isBlank())return
        val data=Base64.decode(encoded,Base64.DEFAULT);val xL=(widthBytes and 0xFF).toByte();val xH=((widthBytes shr 8) and 0xFF).toByte();val yL=(height and 0xFF).toByte();val yH=((height shr 8) and 0xFF).toByte()
        raw(byteArrayOf(0x1D,0x76,0x30,0x00,xL,xH,yL,yH))
        val chunkSize=256
        for(i in data.indices step chunkSize){
            val end=(i+chunkSize).coerceAtMost(data.size)
            raw(data.copyOfRange(i,end))
            try { Thread.sleep(8) } catch(_:Exception){}
        }
    }
    private fun qr(value:String,size:Int){
        val bytes=value.toByteArray(Charsets.UTF_8);raw(byteArrayOf(0x1D,0x28,0x6B,0x04,0x00,0x31,0x41,0x32,0x00));raw(byteArrayOf(0x1D,0x28,0x6B,0x03,0x00,0x31,0x43,size.coerceIn(1,16).toByte()));raw(byteArrayOf(0x1D,0x28,0x6B,0x03,0x00,0x31,0x45,0x31));val len=bytes.size+3;raw(byteArrayOf(0x1D,0x28,0x6B,(len and 0xFF).toByte(),((len shr 8) and 0xFF).toByte(),0x31,0x50,0x30));raw(bytes);raw(byteArrayOf(0x1D,0x28,0x6B,0x03,0x00,0x31,0x51,0x30))
    }
    private fun barcodeCode128(value:String,height:Int){
        val safe=value.filter{it.code in 32..126}.take(80);if(safe.isBlank())return;val content="{B$safe".toByteArray(Charsets.US_ASCII);raw(byteArrayOf(0x1D,0x48,0x02));raw(byteArrayOf(0x1D,0x68,height.coerceIn(40,120).toByte()));raw(byteArrayOf(0x1D,0x77,0x02));raw(byteArrayOf(0x1D,0x6B,0x49,content.size.toByte()));raw(content);text("\n")
    }
    private fun calibrationRaster(requestedDots:Int){
        val dots=((requestedDots.coerceIn(200,640)/8)*8).coerceAtLeast(8);val widthBytes=dots/8;val height=40;val data=ByteArray(widthBytes*height)
        fun pixel(x:Int,y:Int){if(x !in 0 until dots||y !in 0 until height)return;val index=y*widthBytes+(x shr 3);data[index]=(data[index].toInt() or (0x80 shr (x and 7))).toByte()}
        for(x in 0 until dots){pixel(x,0);pixel(x,height-1)}
        intArrayOf(0,dots/4,dots/2,(dots*3)/4,dots-1).forEach{x->for(y in 0 until height)pixel(x,y)}
        val xL=(widthBytes and 0xFF).toByte();val xH=((widthBytes shr 8) and 0xFF).toByte();val yL=(height and 0xFF).toByte();val yH=((height shr 8) and 0xFF).toByte();raw(byteArrayOf(0x1D,0x76,0x30,0x00,xL,xH,yL,yH));raw(data);text("\n")
    }
    private fun wrapText(value:String,width:Int):List<String>{
        val safeWidth=width.coerceAtLeast(8);val out=mutableListOf<String>()
        for(paragraph in value.replace("\r","").split("\n")){
            if(paragraph.isBlank()){out.add("");continue}
            var line=""
            for(originalWord in paragraph.trim().split(Regex("\\s+"))){
                var word=originalWord
                if(word.length>safeWidth){
                    if(line.isNotBlank()){out.add(line);line=""}
                    while(word.length>safeWidth){out.add(word.take(safeWidth));word=word.drop(safeWidth)}
                    if(word.isNotBlank())line=word
                } else if(line.isBlank()) line=word
                else if(line.length+1+word.length<=safeWidth) line+=" $word"
                else {out.add(line);line=word}
            }
            if(line.isNotBlank())out.add(line)
        }
        return out
    }
    private fun wrappedText(value:String,width:Int){wrapText(value,width).forEach{text(it+"\n")}}
    private fun ensureConnected(){
        if(socket?.isConnected == true && output != null) return
        val addr = lastConnectedAddress
        if(!addr.isNullOrBlank()){
            try {
                disconnectInternal()
                val adapter = BluetoothAdapter.getDefaultAdapter() ?: throw IllegalStateException("Bluetooth tidak tersedia")
                val device: BluetoothDevice = adapter.getRemoteDevice(addr)
                val newSocket = device.createRfcommSocketToServiceRecord(sppUuid)
                newSocket.connect()
                socket = newSocket
                output = newSocket.outputStream
                return
            } catch(_: Exception) {
                disconnectInternal()
            }
        }
        throw IllegalStateException("Printer belum terhubung atau mati")
    }
    private fun align(value:String){when(value){"left"->center(false);"right"->raw(byteArrayOf(0x1B,0x61,0x02));else->center(true)}}
    private fun center(on:Boolean){raw(byteArrayOf(0x1B,0x61,if(on)1 else 0))}
    private fun bold(on:Boolean){raw(byteArrayOf(0x1B,0x45,if(on)1 else 0))}
    private fun doubleSize(on:Boolean){raw(byteArrayOf(0x1D,0x21,if(on)0x11 else 0x00))}
    private fun doubleWidth(on:Boolean){raw(byteArrayOf(0x1D,0x21,if(on)0x10 else 0x00))}
    private fun cut(){raw(byteArrayOf(0x1D,0x56,0x00))}
    private fun feed(lines:Int){repeat(lines){text("\n")}}
    private fun line(ch:Char,width:Int){text(ch.toString().repeat(width)+"\n")}
    private fun text(value:String){raw(value.toByteArray(charset))}
    @Synchronized private fun raw(bytes:ByteArray){output!!.write(bytes);output!!.flush()}
    private fun money(value:Long)=String.format("%,d",value).replace(',','.')
    private fun columns(left:String,right:String,width:Int):String{val room=(width-right.length).coerceAtLeast(1);val l=if(left.length>room)left.take(room)else left;return l.padEnd(room,' ')+right}
    private fun disconnectInternal(){try{output?.close()}catch(_:Exception){};try{socket?.close()}catch(_:Exception){};output=null;socket=null}
    override fun handleOnDestroy(){disconnectInternal();io.shutdownNow();super.handleOnDestroy()}
}

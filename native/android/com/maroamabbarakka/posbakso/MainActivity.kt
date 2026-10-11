package com.maroamabbarakka.posbakso

import android.os.Bundle
import com.getcapacitor.BridgeActivity

class MainActivity : BridgeActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        registerPlugin(EscPosPrinterPlugin::class.java)
        super.onCreate(savedInstanceState)
    }
}

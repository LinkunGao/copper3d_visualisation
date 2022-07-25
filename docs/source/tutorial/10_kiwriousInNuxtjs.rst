Build in Nuxtjs
==================

Because when we develop a nuxt project,after we build it will automatically create a ``_nuxt`` folder to store our js files. 

Then the kiwrious config files url will automatical be changed to ``your/baseurl/_nuxt/libunicorn.out.wasm``. So if we only put the file under static folder, it will be packaged outsitde of _nuxt folder, then the programe will get error! 



how to setup kiwrious after build/generate?
-------------------------------------------------

There are two kiwrious config files, we must paste them in to build folder under ``_nuxt`` folder! Then you can use the basic url to find out the config file, such as ``libunicorn.out.wasm``, if you put the file directly in to ``static`` folder when you are developing.

- ``libunicorn.out.wasm``
    - See the origin file, (click this :download:`link <./kiwrious/libunicorn.out.wasm>` to download a copy of this file)
- ``prog.bin``
    - See the origin file, (click this :download:`link <./kiwrious/prog.bin>` to download a copy of this file)
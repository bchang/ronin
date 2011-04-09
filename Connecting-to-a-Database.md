---
title: Connecting to a Database
layout: default
---

Connecting Tosa to a database is easy: simply place a text file with the
extension ".dbc" somewhere in your Gosu classpath. The contents of the file
should be a single JDBC URL. For example, if you have an H2 database called
"test.db", the contents of your .dbc file should be

`jdbc:h2:test.db;USER=sa;PASSWORD=`

(Modify the username and password as appropriate.) Note that relative URLs are
resolved relative to where you launch Gosu from, not relative to the .dbc file
itself.

Next, create a file with the extension ".ddl" alongside your .dbc file.  This file
contains the database schema in standard [DDL][1] format.

That's it! You can now access the types in your
database. The package in which those types live is determined by the location
of the .dbc file in your classpath, plus the name of the .dbc file. So if your
file is named "test.dbc", and it's in a folder called "db", the types will be
in a package called `db.test`.

Note: if you're using either H2 or MySQL, Tosa will automatically
initialize the JDBC connector for you. If you're using any other database,
though, you'll need to set a system property to let Tosa know what class
serves as the connector for your database. The name of the property is
`db.driver.[database name]`, where `[database name]` is the same as what
immediately follows "`jdbc:`" in the JDBC URL, and the value of the property
should be the fully qualified class name of the connector class. Consult your
database's documentation for more information.

Next, we'll learn how to [add, update, and delete entities](Adding,-Updating,-and-Deleting.html).

  [1]: http://en.wikipedia.org/wiki/Data_Definition_Language